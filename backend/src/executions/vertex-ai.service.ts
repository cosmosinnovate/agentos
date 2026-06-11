import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ModelResponse {
  text: string;
  tokensPrompt: number;
  tokensCompletion: number;
  model: string;
  latencyMs: number;
}

@Injectable()
export class VertexAiService {
  private readonly logger = new Logger(VertexAiService.name);
  private readonly mockMode: boolean;

  constructor(private configService: ConfigService) {
    this.mockMode =
      configService.get('MOCK_MODE', 'true') === 'true' ||
      !configService.get('GCP_PROJECT_ID');
  }

  async generateContent(
    modelName: string,
    systemPrompt: string,
    userMessage: string,
    tools: string[] = [],
  ): Promise<ModelResponse> {
    if (this.mockMode) {
      return this.mockGenerate(modelName, userMessage, tools);
    }
    return this.realGenerate(modelName, systemPrompt, userMessage, tools);
  }

  private async mockGenerate(
    modelName: string,
    userMessage: string,
    tools: string[],
  ): Promise<ModelResponse> {
    this.logger.log(`[MOCK] Generating response with model: ${modelName}`);

    const start = Date.now();

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 700));

    const toolsInfo = tools.length > 0 ? ` I have access to the following tools: ${tools.join(', ')}.` : '';
    const mockResponse = `[Mock Response — ${modelName}]

I received your message: "${userMessage}"${toolsInfo}

In production, this would be a real response from ${modelName} via Vertex AI. The agent would:
1. Analyze your request
2. Use available tools if needed (${tools.length > 0 ? tools.join(', ') : 'none configured'})
3. Return a structured response

To enable real AI responses, configure your GCP_PROJECT_ID in the backend .env file and set MOCK_MODE=false.`;

    const latencyMs = Date.now() - start;
    const fakeTokensPrompt = Math.floor(userMessage.length / 4);
    const fakeTokensCompletion = Math.floor(mockResponse.length / 4);

    return {
      text: mockResponse,
      tokensPrompt: fakeTokensPrompt,
      tokensCompletion: fakeTokensCompletion,
      model: modelName,
      latencyMs,
    };
  }

  private async realGenerate(
    modelName: string,
    systemPrompt: string,
    userMessage: string,
    tools: string[],
  ): Promise<ModelResponse> {
    try {
      const { VertexAI } = require('@google-cloud/vertexai');

      const projectId = this.configService.get('GCP_PROJECT_ID');
      const location = this.configService.get('VERTEX_AI_LOCATION', 'us-central1');

      const vertexAI = new VertexAI({ project: projectId, location });
      const generativeModel = vertexAI.getGenerativeModel({ model: modelName });

      const start = Date.now();

      const request = {
        contents: [
          {
            role: 'user',
            parts: [{ text: userMessage }],
          },
        ],
      };

      if (systemPrompt) {
        (request as any).systemInstruction = {
          parts: [{ text: systemPrompt }],
        };
      }

      const result = await generativeModel.generateContent(request);
      const response = result.response;
      const latencyMs = Date.now() - start;

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const usageMetadata = response.usageMetadata || {};

      return {
        text,
        tokensPrompt: usageMetadata.promptTokenCount || 0,
        tokensCompletion: usageMetadata.candidatesTokenCount || 0,
        model: modelName,
        latencyMs,
      };
    } catch (error) {
      this.logger.error(`Vertex AI error: ${error.message}`);
      throw error;
    }
  }

  estimateCost(model: string, tokensPrompt: number, tokensCompletion: number): number {
    // Approximate pricing (USD per 1K tokens)
    const pricing: Record<string, { input: number; output: number }> = {
      'gemini-2.5-pro': { input: 0.00125, output: 0.005 },
      'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
      'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },
      'gemini-pro': { input: 0.0005, output: 0.0015 },
    };

    const modelKey = Object.keys(pricing).find((k) => model.includes(k)) || 'gemini-pro';
    const rates = pricing[modelKey];

    return (
      (tokensPrompt / 1000) * rates.input +
      (tokensCompletion / 1000) * rates.output
    );
  }
}
