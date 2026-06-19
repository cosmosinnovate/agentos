export interface ModelRequest {
  model: string;
  systemPrompt?: string;
  userMessage?: string;
  tools?: string[];
  temperature?: number;
  maxTokens?: number;
  messages?: { role: string; content: string; name?: string }[];
}

export interface ModelResponse {
  text: string;
  tokensPrompt: number;
  tokensCompletion: number;
  model: string;
  provider: string;
  latencyMs: number;
}

export interface IModelProvider {
  readonly providerName: string;
  readonly supportedModels: string[];
  generate(request: ModelRequest): Promise<ModelResponse>;
  isConfigured(): boolean;
}
