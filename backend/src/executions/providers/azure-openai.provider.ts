import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IModelProvider, ModelRequest, ModelResponse } from './model-provider.interface';

/**
 * Azure OpenAI provider.
 * Uses the same openai npm package but with a custom baseURL pointing to your Azure endpoint.
 * Requires: AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_VERSION
 */
@Injectable()
export class AzureOpenAiModelProvider implements IModelProvider {
  readonly providerName = 'azure-openai';
  readonly supportedModels = ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-35-turbo'];
  private readonly logger = new Logger(AzureOpenAiModelProvider.name);

  constructor(private configService: ConfigService) {}

  isConfigured(): boolean {
    return !!(
      this.configService.get('AZURE_OPENAI_API_KEY') &&
      this.configService.get('AZURE_OPENAI_ENDPOINT')
    );
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const apiKey = this.configService.get('AZURE_OPENAI_API_KEY');
    const endpoint = this.configService.get('AZURE_OPENAI_ENDPOINT');
    const apiVersion = this.configService.get('AZURE_OPENAI_API_VERSION', '2024-08-01-preview');

    if (!apiKey || !endpoint) {
      throw new Error('AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT are not configured');
    }

    const { AzureOpenAI } = await import('openai').catch(() => {
      throw new Error('Package openai is not installed. Run: npm install openai');
    });

    const client = new AzureOpenAI({ endpoint, apiKey, apiVersion });
    const start = Date.now();

    const deploymentName = request.model || this.configService.get('AZURE_OPENAI_DEPLOYMENT', 'gpt-4o');

    const messages: any[] = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.userMessage });

    const response = await client.chat.completions.create({
      model: deploymentName,
      messages,
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
      provider: 'azure-openai',
      latencyMs,
    };
  }
}
