import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IModelProvider, ModelRequest, ModelResponse } from './model-provider.interface';

/**
 * AWS Bedrock provider.
 * Supports Claude (Anthropic), Titan, Llama, Mistral models hosted on AWS Bedrock.
 * Requires: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
 */
@Injectable()
export class BedrockModelProvider implements IModelProvider {
  readonly providerName = 'bedrock';
  readonly supportedModels = [
    'anthropic.claude-3-5-sonnet-20241022-v2:0',
    'anthropic.claude-3-haiku-20240307-v1:0',
    'amazon.titan-text-express-v1',
    'meta.llama3-8b-instruct-v1:0',
    'mistral.mistral-7b-instruct-v0:2',
  ];
  private readonly logger = new Logger(BedrockModelProvider.name);

  constructor(private configService: ConfigService) {}

  isConfigured(): boolean {
    return !!(
      this.configService.get('AWS_ACCESS_KEY_ID') &&
      this.configService.get('AWS_SECRET_ACCESS_KEY')
    );
  }

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const accessKey = this.configService.get('AWS_ACCESS_KEY_ID');
    const secretKey = this.configService.get('AWS_SECRET_ACCESS_KEY');
    if (!accessKey || !secretKey) throw new Error('AWS credentials are not configured');

    const { BedrockRuntimeClient, InvokeModelCommand } =
      await import('@aws-sdk/client-bedrock-runtime').catch(() => {
        throw new Error(
          'Package @aws-sdk/client-bedrock-runtime is not installed. Run: npm install @aws-sdk/client-bedrock-runtime',
        );
      });

    const region = this.configService.get('AWS_REGION', 'us-east-1');
    const client = new BedrockRuntimeClient({
      region,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });

    const modelId = request.model || 'anthropic.claude-3-haiku-20240307-v1:0';
    const start = Date.now();

    // Bedrock Claude message format
    const body = JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: request.maxTokens || 4096,
      system: request.systemPrompt,
      messages: [{ role: 'user', content: request.userMessage }],
    });

    const command = new InvokeModelCommand({
      modelId,
      body,
      contentType: 'application/json',
      accept: 'application/json',
    });

    const response = await client.send(command);
    const latencyMs = Date.now() - start;
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    const text = responseBody.content?.[0]?.text || responseBody.outputText || '';

    return {
      text,
      tokensPrompt: responseBody.usage?.input_tokens || 0,
      tokensCompletion: responseBody.usage?.output_tokens || 0,
      model: modelId,
      provider: 'bedrock',
      latencyMs,
    };
  }
}
