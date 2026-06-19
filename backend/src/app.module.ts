import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsModule } from './agents/agents.module';
import { DeploymentsModule } from './deployments/deployments.module';
import { ToolsModule } from './tools/tools.module';
import { ExecutionsModule } from './executions/executions.module';
import { SettingsModule } from './settings/settings.module';
import { ProviderConfig } from './settings/entities/provider-config.entity';
import { Agent } from './agents/entities/agent.entity';
import { AgentVersion } from './agents/entities/agent-version.entity';
import { AgentDeployment } from './deployments/entities/agent-deployment.entity';
import { Tool } from './tools/entities/tool.entity';
import { AgentTool } from './tools/entities/agent-tool.entity';
import { Execution } from './executions/entities/execution.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST', 'localhost'),
        port: parseInt(configService.get('DATABASE_PORT', '5432')),
        username: configService.get('DATABASE_USER', 'agentos'),
        password: configService.get('DATABASE_PASSWORD', 'agentos_secret'),
        database: configService.get('DATABASE_NAME', 'agentos'),
        entities: [Agent, AgentVersion, AgentDeployment, Tool, AgentTool, Execution, ProviderConfig],
        synchronize: true, // Auto-creates tables in dev
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    AgentsModule,
    DeploymentsModule,
    ToolsModule,
    ExecutionsModule,
    SettingsModule,
  ],
})
export class AppModule {}
