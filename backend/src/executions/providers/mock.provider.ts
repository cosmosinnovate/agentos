import { Injectable, Logger } from '@nestjs/common';
import { IModelProvider, ModelRequest, ModelResponse } from './model-provider.interface';

/**
 * Mock provider — returns realistic canned responses instantly.
 * Used when no provider credentials are configured or provider = 'mock'.
 */
@Injectable()
export class MockModelProvider implements IModelProvider {
  readonly providerName = 'mock';
  readonly supportedModels = ['mock-model'];
  private readonly logger = new Logger(MockModelProvider.name);

  isConfigured(): boolean {
    return true; // Always available
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const promptText = request.messages && request.messages.length > 0
      ? request.messages[request.messages.length - 1].content
      : request.userMessage;

    this.logger.log(`[MOCK] Generating response for: "${promptText.substring(0, 60)}..."`);
    const start = Date.now();

    await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));

    let text = '';
    const hasToolResult = request.messages && request.messages.some(
      (m) => m.role === 'tool' || 
             (m.role === 'user' && m.name) || 
             m.content.includes('[Tool Output:') ||
             m.content.includes('weather report') || 
             m.content.includes('weather') ||
             m.content.includes('flight')
    );

    if (!hasToolResult && request.tools && request.tools.length > 0) {
      const firstTool = request.tools[0];
      const mockArgs: Record<string, any> = firstTool === 'local-weather'
        ? { location: 'seattle' }
        : firstTool === 'external-summarizer'
        ? { topic: 'AI Agent Architecture', points: ['Decoupled control plane', 'Standardized MCP registry', 'OTel span tracing'] }
        : { query: 'test' };

      text = `\`\`\`json
{
  "type": "tool_call",
  "name": "${firstTool}",
  "arguments": ${JSON.stringify(mockArgs, null, 2)}
}
\`\`\``;
    } else if (hasToolResult) {
      // Find the last tool output in the message history to compile the final summary
      const lastToolOutput = request.messages && [...request.messages].reverse().find(m => m.content.includes('[Tool Output:'));
      const outputText = lastToolOutput ? lastToolOutput.content : 'mock tool execution successful';
      text = `Based on the tool execution result, here is the compiled summary: \n\n${outputText}\n\nThis is a simulated final agent summary response from AgentOS.`;
    } else {
      const toolsInfo =
        request.tools?.length > 0
          ? `\n\nAvailable tools: ${request.tools.join(', ')}.`
          : '';
      text = `[Mock AI Response]
  
You asked: "${promptText}"${toolsInfo}
  
This is a simulated response from AgentOS. In production, this agent would call a real AI model (OpenAI, Anthropic, Vertex AI, etc.) based on its YAML configuration.`;
    }

    const latencyMs = Date.now() - start;
    return {
      text,
      tokensPrompt: Math.floor(promptText.length / 4),
      tokensCompletion: Math.floor(text.length / 4),
      model: request.model || 'mock-model',
      provider: 'mock',
      latencyMs,
    };
  }
}
