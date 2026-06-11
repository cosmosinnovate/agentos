import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeploymentsController } from './deployments.controller';
import { DeploymentsService } from './deployments.service';
import { AgentDeployment } from './entities/agent-deployment.entity';
import { AgentsModule } from '../agents/agents.module';
import { DeploymentProviderFactory } from './providers/deployment-provider.factory';
import { LocalDeploymentProvider } from './providers/local.provider';
import { GcpDeploymentProvider } from './providers/gcp.provider';
import { AwsDeploymentProvider } from './providers/aws.provider';
import { AzureDeploymentProvider } from './providers/azure.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentDeployment]),
    AgentsModule,
  ],
  controllers: [DeploymentsController],
  providers: [
    DeploymentsService,
    DeploymentProviderFactory,
    LocalDeploymentProvider,
    GcpDeploymentProvider,
    AwsDeploymentProvider,
    AzureDeploymentProvider,
  ],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
