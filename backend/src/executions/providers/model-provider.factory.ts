import { Injectable } from '@nestjs/common';
import { IModelProvider } from './model-provider.interface';
import { MockModelProvider } from './mock.provider';
import { OpenAiModelProvider } from './openai.provider';
import { AnthropicModelProvider } from './anthropic.provider';
import { VertexModelProvider } from './vertex.provider';
import { BedrockModelProvider } from './bedrock.provider';
import { AzureOpenAiModelProvider } from './azure-openai.provider';
import { OllamaModelProvider } from './ollama.provider';
import { GeminiModelProvider } from './gemini.provider';

@Injectable()
export class ModelProviderFactory {
  private providers: Map<string, IModelProvider>;

  constructor(
    private mockProvider: MockModelProvider,
    private openAiProvider: OpenAiModelProvider,
    private anthropicProvider: AnthropicModelProvider,
    private vertexProvider: VertexModelProvider,
    private bedrockProvider: BedrockModelProvider,
    private azureOpenAiProvider: AzureOpenAiModelProvider,
    private ollamaProvider: OllamaModelProvider,
    private geminiProvider: GeminiModelProvider,
  ) {}

  private getProviderMap(): Map<string, IModelProvider> {
    if (!this.providers) {
      this.providers = new Map<string, IModelProvider>([
        ['mock', this.mockProvider],
        ['openai', this.openAiProvider],
        ['anthropic', this.anthropicProvider],
        ['vertex', this.vertexProvider],
        ['bedrock', this.bedrockProvider],
        ['azure-openai', this.azureOpenAiProvider],
        ['ollama', this.ollamaProvider],
        ['gemini', this.geminiProvider],
      ]);
    }
    return this.providers;
  }

  /**
   * Resolves the correct model provider from the agent's YAML definition.
   * If the resolved provider is not configured (missing API keys), falls back to mock.
   *
   * Agent YAML:
   *   spec:
   *     model:
   *       provider: openai    # openai | anthropic | vertex | bedrock | azure-openai | mock
   *       name: gpt-4o
   */
  async getProvider(definition: Record<string, any>): Promise<IModelProvider> {
    const providerName = definition?.spec?.model?.provider || 'mock';
    const providerMap = this.getProviderMap();
    const provider = providerMap.get(providerName);

    if (!provider) {
      console.warn(`Unknown model provider '${providerName}', falling back to mock`);
      return this.mockProvider;
    }

    const configured = await provider.isConfigured();
    if (!configured) {
      console.warn(
        `Provider '${providerName}' is not configured (missing API keys). Falling back to mock. ` +
        `Configure credentials in backend/.env to use real AI.`,
      );
      return this.mockProvider;
    }

    return provider;
  }

  async listProviders(): Promise<Array<{ name: string; configured: boolean; models: string[] }>> {
    const providers = Array.from(this.getProviderMap().entries());
    const results = [];
    for (const [name, p] of providers) {
      const configured = await p.isConfigured();
      results.push({
        name,
        configured: !!configured,
        models: p.supportedModels,
      });
    }
    return results;
  }

  estimateCost(provider: string, model: string, tokensPrompt: number, tokensCompletion: number): number {
    // Pricing per 1K tokens (USD) — approximate as of 2025
    const pricing: Record<string, { input: number; output: number }> = {
      // OpenAI
      'openai:gpt-4o': { input: 0.0025, output: 0.01 },
      'openai:gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'openai:gpt-4-turbo': { input: 0.01, output: 0.03 },
      // Anthropic
      'anthropic:claude-3-5-sonnet': { input: 0.003, output: 0.015 },
      'anthropic:claude-3-haiku': { input: 0.00025, output: 0.00125 },
      // Vertex
      'vertex:gemini-2.5-pro': { input: 0.00125, output: 0.005 },
      'vertex:gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
      // Bedrock (Claude via Bedrock has slightly different pricing)
      'bedrock:claude-3-haiku': { input: 0.00025, output: 0.00125 },
      // Azure OpenAI (similar to OpenAI)
      'azure-openai:gpt-4o': { input: 0.0025, output: 0.01 },
      // Default
      default: { input: 0.001, output: 0.002 },
    };

    const key = Object.keys(pricing).find((k) => k.startsWith(provider) && model.includes(k.split(':')[1]));
    const rates = pricing[key] || pricing['default'];

    return (tokensPrompt / 1000) * rates.input + (tokensCompletion / 1000) * rates.output;
  }
}
