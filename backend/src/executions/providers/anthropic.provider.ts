import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IModelProvider, ModelRequest, ModelResponse } from './model-provider.interface';

@Injectable()
export class AnthropicModelProvider implements IModelProvider {
  readonly providerName = 'anthropic';
  readonly supportedModels = [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ];
  private readonly logger = new Logger(AnthropicModelProvider.name);

  constructor(private configService: ConfigService) {}

  isConfigured(): boolean {
    return !!this.configService.get('ANTHROPIC_API_KEY');
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const apiKey = this.configService.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

    const { default: Anthropic } = await import('@anthropic-ai/sdk').catch(() => {
      throw new Error('Package @anthropic-ai/sdk is not installed. Run: npm install @anthropic-ai/sdk');
    });

    const client = new Anthropic({ apiKey });
    const start = Date.now();

    const response = await client.messages.create({
      model: request.model || 'claude-3-5-sonnet-20241022',
      max_tokens: request.maxTokens || 8096,
      system: request.systemPrompt,
      messages: [{ role: 'user', content: request.userMessage }],
    });

    const latencyMs = Date.now() - start;
    const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('');

    return {
      text,
      tokensPrompt: response.usage.input_tokens,
      tokensCompletion: response.usage.output_tokens,
      model: response.model,
      provider: 'anthropic',
      latencyMs,
    };
  }
}
