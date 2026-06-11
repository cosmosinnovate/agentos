import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Execution } from './entities/execution.entity';
import { ModelProviderFactory } from './providers/model-provider.factory';
import { AgentsService } from '../agents/agents.service';
import { InvokeAgentDto } from '../agents/dto/agent.dto';

@Injectable()
export class ExecutionsService {
  constructor(
    @InjectRepository(Execution)
    private executionRepo: Repository<Execution>,
    private modelProviderFactory: ModelProviderFactory,
    private agentsService: AgentsService,
  ) {}

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

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(agent.name, definition, dto.context);

    // Generate response
    const modelResponse = await modelProvider.generate({
      model: modelName,
      systemPrompt,
      userMessage: dto.message,
      tools,
    });

    // Estimate cost
    const cost = this.modelProviderFactory.estimateCost(
      modelResponse.provider,
      modelResponse.model,
      modelResponse.tokensPrompt,
      modelResponse.tokensCompletion,
    );

    // Persist execution record
    const execution = this.executionRepo.create({
      agentId,
      versionId: version.id,
      requestPayload: { message: dto.message, context: dto.context },
      responsePayload: { result: modelResponse.text },
      latencyMs: modelResponse.latencyMs,
      tokensPrompt: modelResponse.tokensPrompt,
      tokensCompletion: modelResponse.tokensCompletion,
      totalCost: cost,
      status: 'SUCCESS',
      model: `${modelResponse.provider}/${modelResponse.model}`,
    });

    const saved = await this.executionRepo.save(execution);

    return {
      executionId: saved.id,
      result: modelResponse.text,
      trace: {
        agentId,
        agentName: agent.name,
        version: version.version,
        provider: modelResponse.provider,
        model: modelResponse.model,
        latencyMs: modelResponse.latencyMs,
        tokensPrompt: modelResponse.tokensPrompt,
        tokensCompletion: modelResponse.tokensCompletion,
        totalTokens: modelResponse.tokensPrompt + modelResponse.tokensCompletion,
        estimatedCostUsd: parseFloat(cost.toFixed(6)),
        timestamp: saved.createdAt,
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

  private buildSystemPrompt(name: string, definition: Record<string, any>, ctx?: string): string {
    const tools = definition.spec?.tools || [];
    let prompt = `You are ${name}, an AI agent managed by AgentOS.`;
    if (tools.length) prompt += `\n\nYou have access to these tools: ${tools.join(', ')}.`;
    if (definition.spec?.permissions?.length)
      prompt += `\n\nYour permissions: ${definition.spec.permissions.join(', ')}.`;
    if (ctx) prompt += `\n\nAdditional context: ${ctx}`;
    return prompt;
  }
}
