import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IModelProvider, ModelRequest, ModelResponse } from './model-provider.interface';

@Injectable()
export class OllamaModelProvider implements IModelProvider {
  readonly providerName = 'ollama';
  readonly supportedModels = ['llama3', 'llama2', 'mistral', 'gemma', 'codellama', 'phi3'];
  private readonly logger = new Logger(OllamaModelProvider.name);

  constructor(private configService: ConfigService) {}

  isConfigured(): boolean {
    // Ollama is local, so we assume it is configured if the user wants to use it.
    // OLLAMA_BASE_URL can override the default localhost port.
    return true;
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const baseUrl = this.configService.get('OLLAMA_BASE_URL', 'http://localhost:11434');
    const modelName = request.model || 'llama3';
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

    try {
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          messages,
          stream: false,
          options: {
            temperature: request.temperature ?? 0.7,
            num_predict: request.maxTokens,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as any;
      const latencyMs = Date.now() - start;

      return {
        text: data.message?.content || '',
        tokensPrompt: data.prompt_eval_count || 0,
        tokensCompletion: data.eval_count || 0,
        model: data.model || modelName,
        provider: 'ollama',
        latencyMs,
      };
    } catch (error) {
      this.logger.error(`Failed to connect to Ollama at ${baseUrl}: ${error.message}`);
      throw new Error(
        `Ollama connection failed. Please ensure Ollama is running locally at ${baseUrl} ` +
        `and the model "${modelName}" is pulled (e.g., "ollama run ${modelName}"). Error: ${error.message}`
      );
    }
  }
}
