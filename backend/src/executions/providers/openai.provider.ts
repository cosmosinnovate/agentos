import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IModelProvider, ModelRequest, ModelResponse } from './model-provider.interface';

@Injectable()
export class OpenAiModelProvider implements IModelProvider {
  readonly providerName = 'openai';
  readonly supportedModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
  private readonly logger = new Logger(OpenAiModelProvider.name);

  constructor(private configService: ConfigService) {}

  isConfigured(): boolean {
    return !!this.configService.get('OPENAI_API_KEY');
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const apiKey = this.configService.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

    const { default: OpenAI } = await import('openai').catch(() => {
      throw new Error('Package openai is not installed. Run: npm install openai');
    });

    const client = new OpenAI({ apiKey });
    const start = Date.now();

    const messages = request.messages && request.messages.length > 0 
      ? request.messages.map(m => ({ role: m.role, content: m.content, ...(m.name ? { name: m.name } : {}) }))
      : [];
    if (messages.length === 0) {
      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      messages.push({ role: 'user', content: request.userMessage });
    }

    const response = await client.chat.completions.create({
      model: request.model || 'gpt-4o',
      messages: messages as any[],
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
    });

    const latencyMs = Date.now() - start;
    const choice = response.choices[0];

    return {
      text: choice.message.content || '',
      tokensPrompt: response.usage?.prompt_tokens || 0,
      tokensCompletion: response.usage?.completion_tokens || 0,
      model: response.model,
      provider: 'openai',
      latencyMs,
    };
  }
}
