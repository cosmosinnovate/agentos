import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IModelProvider, ModelRequest, ModelResponse } from './model-provider.interface';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SettingsService } from '../../settings/settings.service';

@Injectable()
export class GeminiModelProvider implements IModelProvider {
  readonly providerName = 'gemini';
  readonly supportedModels = [
    'gemini-2.5-pro',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-pro',
  ];
  private readonly logger = new Logger(GeminiModelProvider.name);

  constructor(
    private configService: ConfigService,
    private settingsService: SettingsService,
  ) {}

  async isConfigured(): Promise<boolean> {
    const dbKey = await this.settingsService.getApiKey(this.providerName);
    return !!dbKey || !!this.configService.get('GEMINI_API_KEY');
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    let apiKey = await this.settingsService.getApiKey(this.providerName);
    if (!apiKey) {
      apiKey = this.configService.get('GEMINI_API_KEY');
    }
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = request.model || 'gemini-1.5-flash';
    const generativeModel = genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction: request.systemPrompt || undefined,
    });
    
    const start = Date.now();

    const contents = request.messages && request.messages.length > 0
      ? request.messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }))
      : [{ role: 'user', parts: [{ text: request.userMessage }] }];

    const result = await generativeModel.generateContent({
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.0,
      }
    });

    const response = result.response;
    const latencyMs = Date.now() - start;
    const text = response.text();
    const usage = response.usageMetadata || {};

    return {
      text,
      tokensPrompt: (usage as any).promptTokenCount || 0,
      tokensCompletion: (usage as any).candidatesTokenCount || 0,
      model: modelName,
      provider: 'gemini',
      latencyMs,
    };
  }
}
