import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExecutionsController } from './executions.controller';
import { ExecutionsService } from './executions.service';
import { Execution } from './entities/execution.entity';
import { AgentsModule } from '../agents/agents.module';
import { ModelProviderFactory } from './providers/model-provider.factory';
import { MockModelProvider } from './providers/mock.provider';
import { OpenAiModelProvider } from './providers/openai.provider';
import { AnthropicModelProvider } from './providers/anthropic.provider';
import { VertexModelProvider } from './providers/vertex.provider';
import { BedrockModelProvider } from './providers/bedrock.provider';
import { AzureOpenAiModelProvider } from './providers/azure-openai.provider';
import { OllamaModelProvider } from './providers/ollama.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([Execution]),
    forwardRef(() => AgentsModule),
  ],
  controllers: [ExecutionsController],
  providers: [
    ExecutionsService,
    ModelProviderFactory,
    MockModelProvider,
    OpenAiModelProvider,
    AnthropicModelProvider,
    VertexModelProvider,
    BedrockModelProvider,
    AzureOpenAiModelProvider,
    OllamaModelProvider,
  ],
  exports: [ExecutionsService, ModelProviderFactory],
})
export class ExecutionsModule {}
