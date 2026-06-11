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
    this.logger.log(`[MOCK] Generating response for: "${request.userMessage.substring(0, 60)}..."`);
    const start = Date.now();

    await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));

    const toolsInfo =
      request.tools?.length > 0
        ? `\n\nAvailable tools: ${request.tools.join(', ')}.`
        : '';

    const text = `[Mock AI Response]

You asked: "${request.userMessage}"${toolsInfo}

This is a simulated response from AgentOS. In production, this agent would call a real AI model (OpenAI, Anthropic, Vertex AI, etc.) based on its YAML configuration.

To enable real responses, configure your model provider credentials in the backend \`.env\` file and set the appropriate provider in your agent definition:

\`\`\`yaml
spec:
  model:
    provider: openai    # openai | anthropic | vertex | bedrock | azure-openai
    name: gpt-4o
\`\`\``;

    const latencyMs = Date.now() - start;
    return {
      text,
      tokensPrompt: Math.floor(request.userMessage.length / 4),
      tokensCompletion: Math.floor(text.length / 4),
      model: request.model || 'mock-model',
      provider: 'mock',
      latencyMs,
    };
  }
}
