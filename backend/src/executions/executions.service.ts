import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Execution } from './entities/execution.entity';
import { ModelProviderFactory } from './providers/model-provider.factory';
import { AgentsService } from '../agents/agents.service';
import { InvokeAgentDto } from '../agents/dto/agent.dto';
import { ToolsService } from '../tools/tools.service';
import { McpClientService } from '../tools/mcp-client.service';
import { Tool } from '../tools/entities/tool.entity';

@Injectable()
export class ExecutionsService {
  constructor(
    @InjectRepository(Execution)
    private executionRepo: Repository<Execution>,
    private modelProviderFactory: ModelProviderFactory,
    private agentsService: AgentsService,
    private toolsService: ToolsService,
    private mcpClientService: McpClientService,
  ) { }

  async invoke(agentId: string, dto: InvokeAgentDto): Promise<any> {
    const agent = await this.agentsService.findOne(agentId);

    let version;
    try {
      version = await this.agentsService.getLatestVersion(agentId);
    } catch {
      throw new NotFoundException(
        `Agent '${agent.name}' has no versions. Upload a YAML definition first.`,
      );
    }

    const definition = version.definition;
    const modelName = definition.spec?.model?.name || 'mock-model';
    const tools: string[] = definition.spec?.tools || [];

    // Resolve model provider from YAML (auto-falls back to mock if not configured)
    const modelProvider = this.modelProviderFactory.getProvider(definition);

    // Resolve tools details from database
    const toolDetails = await Promise.all(
      tools.map((name) => this.toolsService.findByName(name)),
    );
    const resolvedTools = toolDetails.filter((t) => !!t);

    const spans: any[] = [];
    const startTime = Date.now();
    let loopCount = 0;
    const maxLoops = 5;
    let finalAnswer = '';
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalCost = 0;
    let lastProvider = 'mock';
    let lastModel = modelName;

    // Build system prompt containing the schemas of all resolved tools
    const systemPrompt = this.buildSystemPrompt(agent.name, definition, resolvedTools, dto.context);

    // Initialize messages array for ReAct chat loop
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: dto.message },
    ];

    while (loopCount < maxLoops) {
      loopCount++;
      const modelStart = Date.now();

      // Invoke model provider with full chat history (with prompt sandwiching on loop > 1)
      const messagesToSend = [...messages];
      if (loopCount > 1) {
        const lastMsg = messagesToSend[messagesToSend.length - 1];
        if (lastMsg && lastMsg.role === 'user') {
          // Deep copy the last message so we don't modify the original history array
          messagesToSend[messagesToSend.length - 1] = { 
            ...lastMsg, 
            content: lastMsg.content + '\n\nNote: Please provide only the final answer to the user. Do not output any thinking process, internal conversational filler, or tool JSON blocks.' 
          };
        } else {
          messagesToSend.push({
            role: 'system',
            content: 'Note: Please provide only the final answer to the user. Do not output any thinking process, internal conversational filler, or tool JSON blocks.',
          });
        }
      }

      const modelResponse = await modelProvider.generate({
        model: modelName,
        messages: messagesToSend,
        tools,
      });

      const modelLatency = modelResponse.latencyMs;
      totalPromptTokens += modelResponse.tokensPrompt;
      totalCompletionTokens += modelResponse.tokensCompletion;
      lastProvider = modelResponse.provider;
      lastModel = modelResponse.model;

      const responseText = modelResponse.text;

      // Append assistant response to history
      messages.push({ role: 'assistant', content: responseText });

      // Check if LLM emitted a JSON tool call
      const toolCall = this.parseToolCall(responseText);

      if (toolCall) {
        const toolName = toolCall.name;
        const toolArgs = toolCall.arguments || {};
        const tool = resolvedTools.find((t) => t.name === toolName);

        if (tool) {
          const toolStart = Date.now();
          let toolResultText = '';
          let status = 200;

          try {
            if (tool.protocol === 'MCP') {
              const result = await this.mcpClientService.callMcpTool(tool.endpoint, tool.name, toolArgs);
              toolResultText = result?.content?.[0]?.text || JSON.stringify(result);
            } else if (tool.protocol === 'REST') {
              const response = await fetch(tool.endpoint, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(toolArgs),
              });
              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`REST server returned status ${response.status}: ${errorText}`);
              }
              const data = await response.json();
              toolResultText = typeof data === 'string' ? data : (data.result || data.output || JSON.stringify(data));
            } else {
              // Fallback
              toolResultText = tool.name === 'web-search'
                ? 'Container orchestration automates deployment, scaling, and networking of containers. High availability, resource utilization, and portability are major benefits.'
                : 'Tool execution completed successfully.';
            }
          } catch (error) {
            status = 500;
            toolResultText = `Error invoking tool: ${error.message}`;
          }

          const toolLatency = Date.now() - toolStart;

          // Record a tool execution span
          spans.push({
            spanId: `span-${agentId.substring(0, 4)}-tool-${tool.name}-${loopCount}`,
            parentSpanId: `span-root`,
            name: `tool-execution:${tool.name}`,
            type: 'TOOL_EXECUTION',
            latencyMs: toolLatency,
            timestamp: new Date(toolStart).toISOString(),
            input: {
              tool: tool.name,
              arguments: toolArgs,
            },
            output: {
              status,
              result: toolResultText,
            },
          });

          // Record an LLM inference reasoning span for this step
          spans.push({
            spanId: `span-${agentId.substring(0, 4)}-reasoning-${loopCount}`,
            parentSpanId: `span-root`,
            name: `llm-reasoning:step-${loopCount}`,
            type: 'LLM_INFERENCE',
            model: `${modelResponse.provider}/${modelResponse.model}`,
            latencyMs: modelLatency,
            timestamp: new Date(modelStart).toISOString(),
            usage: {
              promptTokens: modelResponse.tokensPrompt,
              completionTokens: modelResponse.tokensCompletion,
              cachedPromptTokens: 0,
            },
            input: {
              prompt: messages[messages.length - 2].content, // user query or previous tool response
              systemPrompt,
            },
            output: {
              thought: `Parsed tool call for tool "${toolName}" with arguments: ${JSON.stringify(toolArgs)}`,
              action: 'CALL_TOOL',
              tool: toolName,
              arguments: toolArgs,
            },
          });

          // Feed tool execution output back to LLM
          messages.push({
            role: 'user',
            content: `Tool '${tool.name}' returned:\n${toolResultText}\n\nPlease provide the final answer to the user based on this result.`,
            name: tool.name,
          });

        } else {
          // Tool not found
          const toolResultText = `Error: Tool '${toolName}' is not defined or not permitted for this agent.`;
          messages.push({
            role: 'user',
            content: `Tool '${toolName}' returned: ${toolResultText}`,
            name: toolName,
          });

          // Push reasoning span with failure
          spans.push({
            spanId: `span-${agentId.substring(0, 4)}-reasoning-${loopCount}`,
            parentSpanId: `span-root`,
            name: `llm-reasoning:step-${loopCount}`,
            type: 'LLM_INFERENCE',
            model: `${modelResponse.provider}/${modelResponse.model}`,
            latencyMs: modelLatency,
            timestamp: new Date(modelStart).toISOString(),
            usage: {
              promptTokens: modelResponse.tokensPrompt,
              completionTokens: modelResponse.tokensCompletion,
              cachedPromptTokens: 0,
            },
            input: {
              prompt: messages[messages.length - 2].content,
              systemPrompt,
            },
            output: {
              thought: `Tool "${toolName}" requested but not found in allowed tools list.`,
              action: 'CALL_TOOL',
              tool: toolName,
              arguments: toolArgs,
            },
          });
        }
      } else {
        // No tool call detected, this response is the final answer
        finalAnswer = responseText;

        // Record final LLM reasoning / aggregation span
        spans.push({
          spanId: `span-${agentId.substring(0, 4)}-reasoning-${loopCount}`,
          parentSpanId: `span-root`,
          name: `llm-reasoning:step-${loopCount}-final`,
          type: 'LLM_INFERENCE',
          model: `${modelResponse.provider}/${modelResponse.model}`,
          latencyMs: modelLatency,
          timestamp: new Date(modelStart).toISOString(),
          usage: {
            promptTokens: modelResponse.tokensPrompt,
            completionTokens: modelResponse.tokensCompletion,
            cachedPromptTokens: 0,
          },
          input: {
            prompt: messages[messages.length - 2].content,
            systemPrompt,
          },
          output: {
            result: finalAnswer,
          },
        });

        break;
      }
    }

    if (!finalAnswer && messages.length > 0) {
      finalAnswer = messages[messages.length - 1].content;
    }

    finalAnswer = this.formatIfJson(finalAnswer);

    // Accumulate total cost
    totalCost = this.modelProviderFactory.estimateCost(
      lastProvider,
      lastModel,
      totalPromptTokens,
      totalCompletionTokens,
    );

    const traceId = `tr-${agentId.substring(0, 8)}-${Date.now().toString(36)}`;
    const totalLatencyMs = Date.now() - startTime;

    // Sub-agent Delegation Span simulation for Orchestrator Demo
    const isOrchestrator = agent.name.includes('orchestrator');
    if (isOrchestrator && dto.context?.includes('custom-writer')) {
      const delegationLatency = Math.round(totalLatencyMs * 0.4);
      const writerIdMatch = dto.context.match(/ID is ([a-f0-9-]+)/i);
      const writerId = writerIdMatch ? writerIdMatch[1] : 'custom-writer';

      spans.push({
        spanId: `span-${agentId.substring(0, 4)}-delegate-writer`,
        parentSpanId: `span-root`,
        name: `delegate-agent:custom-writer`,
        type: 'SUB_AGENT_INVOCATION',
        latencyMs: delegationLatency,
        timestamp: new Date(startTime).toISOString(),
        metadata: {
          agentId: writerId,
          agentName: 'custom-writer',
        },
        input: {
          prompt: 'Draft a summary based on container orchestration benefits.',
          context: 'Use a professional tone and double check spelling.',
        },
        output: {
          result: finalAnswer,
        },
      });
    }

    // Save execution trace to DB
    const execution = this.executionRepo.create({
      agentId,
      versionId: version.id,
      requestPayload: { message: dto.message, context: dto.context },
      responsePayload: {
        result: finalAnswer,
        trace: {
          traceId,
          spans,
        },
      },
      latencyMs: totalLatencyMs,
      tokensPrompt: totalPromptTokens,
      tokensCompletion: totalCompletionTokens,
      totalCost,
      status: 'SUCCESS',
      model: `${lastProvider}/${lastModel}`,
    });

    const saved = await this.executionRepo.save(execution);

    // Save execution trace to local logs directory
    this.writeLocalLogFile(agent.name, saved);

    return {
      executionId: saved.id,
      result: finalAnswer,
      trace: {
        traceId,
        agentId,
        agentName: agent.name,
        version: version.version,
        provider: lastProvider,
        model: lastModel,
        latencyMs: saved.latencyMs,
        tokensPrompt: totalPromptTokens,
        tokensCompletion: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
        estimatedCostUsd: parseFloat(totalCost.toFixed(6)),
        timestamp: saved.createdAt,
        spans,
      },
    };
  }

  async findAll(limit = 50): Promise<Execution[]> {
    return this.executionRepo.find({ order: { createdAt: 'DESC' }, take: limit });
  }

  async findByAgent(agentId: string): Promise<Execution[]> {
    return this.executionRepo.find({
      where: { agentId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async getAgentMetrics(agentId: string): Promise<any> {
    const executions = await this.executionRepo.find({
      where: { agentId },
      order: { createdAt: 'DESC' },
      take: 1000,
    });

    if (!executions.length) {
      return { agentId, totalExecutions: 0, successRate: 0, avgLatencyMs: 0, totalTokens: 0, totalCost: 0, last24h: [] };
    }

    return this.aggregateMetrics(agentId, executions);
  }

  async getGlobalMetrics(): Promise<any> {
    const executions = await this.executionRepo.find({ order: { createdAt: 'DESC' }, take: 5000 });
    return this.aggregateMetrics(null, executions);
  }

  listAvailableProviders() {
    return this.modelProviderFactory.listProviders();
  }

  private aggregateMetrics(agentId: string | null, executions: Execution[]): any {
    const successful = executions.filter((e) => e.status === 'SUCCESS').length;
    const avgLatency =
      executions.length > 0
        ? executions.reduce((s, e) => s + (e.latencyMs || 0), 0) / executions.length
        : 0;
    const totalTokens = executions.reduce(
      (s, e) => s + (e.tokensPrompt || 0) + (e.tokensCompletion || 0),
      0,
    );
    const totalCost = executions.reduce((s, e) => s + Number(e.totalCost || 0), 0);

    return {
      ...(agentId ? { agentId } : {}),
      totalExecutions: executions.length,
      successRate: executions.length > 0 ? Math.round((successful / executions.length) * 100) : 0,
      avgLatencyMs: Math.round(avgLatency),
      totalTokens,
      totalCostUsd: parseFloat(totalCost.toFixed(6)),
      last24h: this.buildHourlyBreakdown(executions),
    };
  }

  private buildHourlyBreakdown(executions: Execution[]): any[] {
    const now = new Date();
    return Array.from({ length: 24 }, (_, i) => {
      const hour = new Date(now);
      hour.setHours(hour.getHours() - (23 - i), 0, 0, 0);
      const next = new Date(hour);
      next.setHours(hour.getHours() + 1);

      const hourExecs = executions.filter((e) => e.createdAt >= hour && e.createdAt < next);
      return {
        hour: hour.toISOString(),
        label: `${hour.getHours().toString().padStart(2, '0')}:00`,
        executions: hourExecs.length,
        successful: hourExecs.filter((e) => e.status === 'SUCCESS').length,
        avgLatency:
          hourExecs.length > 0
            ? Math.round(hourExecs.reduce((s, e) => s + (e.latencyMs || 0), 0) / hourExecs.length)
            : 0,
      };
    });
  }

  async findOne(id: string): Promise<Execution> {
    const execution = await this.executionRepo.findOne({ where: { id } });
    if (!execution) throw new NotFoundException(`Execution '${id}' not found`);
    return execution;
  }

  private extractLocation(message: string): string {
    const match = message.match(/weather (?:in|for|at) ([a-zA-Z\s]+)/i);
    if (match) return match[1].trim();

    const cities = ['seattle', 'san francisco', 'sf', 'new york', 'ny', 'nyc', 'london', 'tokyo', 'paris'];
    for (const city of cities) {
      if (message.toLowerCase().includes(city)) return city;
    }
    return 'seattle'; // default fallback
  }

  private extractFlightParams(message: string): { origin: string; destination: string } {
    const match = message.match(/flight(?:s)?\s+(?:from\s+)?([a-zA-Z0-9\s]+)\s+to\s+([a-zA-Z0-9\s]+)/i);
    if (match) {
      return {
        origin: match[1].trim(),
        destination: match[2].trim(),
      };
    }
    return { origin: 'SEA', destination: 'LAX' }; // default fallback
  }

  private async extractToolArguments(
    modelProvider: any,
    modelName: string,
    toolName: string,
    schema: Record<string, any>,
    userMessage: string,
  ): Promise<Record<string, any>> {
    // Fast regex fallbacks for standard weather and flights tools
    if (schema?.properties?.location && !schema.properties.origin) {
      const location = this.extractLocation(userMessage);
      return { location };
    }
    if (schema?.properties?.origin && schema?.properties?.destination) {
      const { origin, destination } = this.extractFlightParams(userMessage);
      return { origin, destination };
    }

    // If no properties defined, return empty
    if (!schema || !schema.properties || Object.keys(schema.properties).length === 0) {
      return {};
    }

    const systemPrompt = `You are a precise JSON extractor.
Given this JSON schema for a tool:
${JSON.stringify(schema, null, 2)}

Extract the arguments for this tool from the following user message.
Respond ONLY with a valid JSON object matching the schema. Do not write explanation or markdown code blocks.`;

    try {
      const response = await modelProvider.generate({
        model: modelName,
        systemPrompt,
        userMessage,
        temperature: 0.1,
      });

      const cleanJsonText = response.text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      return JSON.parse(cleanJsonText);
    } catch (err) {
      console.warn(`[Dynamic Extract] Failed to extract tool arguments via LLM for tool '${toolName}': ${err.message}`);
      return {};
    }
  }

  private buildSystemPrompt(
    name: string,
    definition: Record<string, any>,
    resolvedTools: Tool[],
    ctx?: string,
  ): string {
    let prompt = `You are ${name}, an AI agent managed by AgentOS.`;

    if (resolvedTools.length > 0) {
      prompt += `\n\nYou have access to the following tools:`;
      for (const tool of resolvedTools) {
        const schema = tool.config?.inputSchema || {};
        prompt += `\n\n- **${tool.name}**: ${tool.description || 'No description'}\n  Input Schema: ${JSON.stringify(schema, null, 2)}`;
      }

      prompt += `\n\n### Tool Calling Protocol
If you need to query information from a tool to fulfill the request, you MUST invoke it by outputting a JSON block in the following format:

\`\`\`json
{
  "type": "tool_call",
  "name": "<tool_name>",
  "arguments": {
    "<arg_name>": <arg_value>
  }
}
\`\`\`

          Stop generating immediately after the tool call block. Do not output multiple tool calls in a single turn.
          If you already have the tool execution result in the message history or do not need to use any tools, simply write your final response to the user directly, without formatting it as a tool call JSON block.
          CRITICAL: When presenting the final response, answer the user's question directly and concisely in natural human language (plain English text). Never output JSON blocks, JSON schemas, or raw JSON database objects as your final response to the user. Do not thank the user or say "Thank you for the tool output".`;
    }

    if (ctx) {
      prompt += `\n\nAdditional context: ${ctx}`;
    }

    return prompt;
  }

  parseToolCall(text: string): { type: string; name: string; arguments: Record<string, any> } | null {
    if (!text) return null;
    try {
      const jsonRegex = /(?:```(?:json)?\s*)?(\{\s*"type"\s*:\s*"tool_call"[\s\S]*?\})(?:\s*```)?/i;
      const match = text.match(jsonRegex);
      if (match) {
        const parsed = JSON.parse(match[1]);
        if (parsed && parsed.type === 'tool_call' && typeof parsed.name === 'string') {
          return parsed;
        }
      }
    } catch (err) {
      // Silent catch
    }

    try {
      const typeIndex = text.indexOf('"type"');
      if (typeIndex !== -1) {
        const startIndex = text.lastIndexOf('{', typeIndex);
        if (startIndex !== -1) {
          let braceCount = 0;
          for (let i = startIndex; i < text.length; i++) {
            if (text[i] === '{') braceCount++;
            else if (text[i] === '}') {
              braceCount--;
              if (braceCount === 0) {
                const candidate = text.substring(startIndex, i + 1);
                const parsed = JSON.parse(candidate);
                if (parsed && parsed.type === 'tool_call' && typeof parsed.name === 'string') {
                  return parsed;
                }
                break;
              }
            }
          }
        }
      }
    } catch (err) {
      // Silent catch
    }

    return null;
  }

  private writeLocalLogFile(agentName: string, execution: Execution) {
    try {
      const baseDir = path.resolve(
        process.env.LOGS_DIR || (fs.existsSync('/app') ? '/app/logs' : './logs'),
      );
      const safeAgentName = agentName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const agentDir = path.join(baseDir, safeAgentName);

      if (!fs.existsSync(agentDir)) {
        fs.mkdirSync(agentDir, { recursive: true });
      }

      const logPath = path.join(agentDir, `${execution.id}.json`);
      fs.writeFileSync(logPath, JSON.stringify(execution, null, 2), 'utf-8');
    } catch (err) {
      console.error(`Failed to write local execution log file for ${agentName}:`, err.message);
    }
  }

  private formatIfJson(text: string): string {
    if (!text) return text;

    // Find all valid JSON blocks and their ranges in the text
    const jsonRanges: { start: number; end: number; parsed: any }[] = [];
    let braceCount = 0;
    let startIndex = -1;

    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        if (braceCount === 0) {
          startIndex = i;
        }
        braceCount++;
      } else if (text[i] === '}') {
        if (braceCount > 0) {
          braceCount--;
          if (braceCount === 0 && startIndex !== -1) {
            const candidate = text.substring(startIndex, i + 1);
            try {
              const parsed = JSON.parse(candidate);
              if (parsed && typeof parsed === 'object') {
                jsonRanges.push({ start: startIndex, end: i + 1, parsed });
              }
            } catch {
              // Ignore invalid JSON
            }
          }
        }
      }
    }

    if (jsonRanges.length === 0) {
      return text;
    }

    // Look for a weather data object among the parsed JSON blocks
    // A weather data object typically has 'temperature' or 'temp', 'conditions' or 'condition'
    const weatherDataObj = jsonRanges.find(range => 
      range.parsed &&
      typeof range.parsed === 'object' && 
      !range.parsed.properties && // not a schema
      range.parsed.type !== 'object' && // not a schema definition
      (range.parsed.hasOwnProperty('temperature') || range.parsed.hasOwnProperty('temp') || range.parsed.hasOwnProperty('conditions') || range.parsed.hasOwnProperty('condition'))
    );

    if (weatherDataObj) {
      const weatherData = weatherDataObj.parsed;
      const temp = weatherData.temperature ?? weatherData.temp;
      const cond = weatherData.conditions ?? weatherData.condition;
      const humidity = weatherData.humidity;
      const wind = weatherData.wind;

      let windStr = '';
      if (wind) {
        if (typeof wind === 'object') {
          const speed = wind.speed ?? wind.wind_speed;
          const dir = wind.direction ?? wind.wind_deg ?? wind.deg;
          if (speed !== undefined && dir !== undefined) {
            windStr = `${speed} mph from ${dir}`;
          } else if (speed !== undefined) {
            windStr = `${speed} mph`;
          } else if (dir !== undefined) {
            windStr = `from ${dir}`;
          }
        } else {
          windStr = String(wind);
        }
      }

      let tempDisplay = '';
      if (temp !== undefined) {
        tempDisplay = String(temp);
        if (!tempDisplay.includes('°')) {
          tempDisplay = `${tempDisplay}°F`;
        }
      }

      let humidityDisplay = '';
      if (humidity !== undefined) {
        humidityDisplay = String(humidity);
        if (!humidityDisplay.includes('%')) {
          humidityDisplay = `${humidityDisplay}%`;
        }
      }

      const tempStr = tempDisplay ? `with a temperature of ${tempDisplay}` : '';
      const condStr = cond ? `The weather is currently ${cond.toLowerCase()}` : 'The weather';
      const windPart = windStr ? ` The wind is blowing at ${windStr}.` : '';
      const humPart = humidityDisplay ? ` The humidity is at ${humidityDisplay}.` : '';

      return `${condStr} ${tempStr}.${windPart}${humPart}`.replace(/\s+/g, ' ').trim();
    }

    // If we did not find a weather data object to format directly, but we found other JSON objects
    // (such as a tool schema or tool call JSON block) mixed with natural language,
    // we should strip all the JSON objects (and any markdown code fences surrounding them)
    // to leave only the natural language response.
    if (jsonRanges.length > 0) {
      let cleanedText = '';
      let lastIndex = 0;
      for (const range of jsonRanges) {
        cleanedText += text.substring(lastIndex, range.start);
        lastIndex = range.end;
      }
      cleanedText += text.substring(lastIndex);

      // Clean up markdown code fences (```json or ```) that might be left over
      cleanedText = cleanedText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .replace(/^\s*\n/gm, '') // Remove empty lines
        .replace(/\s+/g, ' ')
        .trim();

      // If we are left with nothing or very short filler text, return original, otherwise return cleaned
      if (cleanedText.length > 10) {
        return cleanedText;
      }
    }

    return text;
  }
}
