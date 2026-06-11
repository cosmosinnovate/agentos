import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IModelProvider, ModelRequest, ModelResponse } from './model-provider.interface';

@Injectable()
export class VertexModelProvider implements IModelProvider {
  readonly providerName = 'vertex';
  readonly supportedModels = [
    'gemini-2.5-pro',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-pro',
  ];
  private readonly logger = new Logger(VertexModelProvider.name);

  constructor(private configService: ConfigService) {}

  isConfigured(): boolean {
    return !!this.configService.get('GCP_PROJECT_ID');
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const projectId = this.configService.get('GCP_PROJECT_ID');
    if (!projectId) throw new Error('GCP_PROJECT_ID is not configured');

    const { VertexAI } = await import('@google-cloud/vertexai').catch(() => {
      throw new Error('Package @google-cloud/vertexai is not installed. Run: npm install @google-cloud/vertexai');
    });

    const location = this.configService.get('GCP_REGION', 'us-central1');
    const vertexAI = new VertexAI({ project: projectId, location });
    const generativeModel = vertexAI.getGenerativeModel({ model: request.model || 'gemini-1.5-flash' });
    const start = Date.now();

    const req: any = {
      contents: [{ role: 'user', parts: [{ text: request.userMessage }] }],
    };
    if (request.systemPrompt) {
      req.systemInstruction = { parts: [{ text: request.systemPrompt }] };
    }

    const result = await generativeModel.generateContent(req);
    const response = result.response;
    const latencyMs = Date.now() - start;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const usage = response.usageMetadata || {};

    return {
      text,
      tokensPrompt: usage.promptTokenCount || 0,
      tokensCompletion: usage.candidatesTokenCount || 0,
      model: request.model,
      provider: 'vertex',
      latencyMs,
    };
  }
}
