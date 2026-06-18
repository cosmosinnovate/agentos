import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { Agent } from './entities/agent.entity';
import { AgentVersion } from './entities/agent-version.entity';
import { Execution } from '../executions/entities/execution.entity';
import { ExecutionsModule } from '../executions/executions.module';
import { DeploymentsModule } from '../deployments/deployments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Agent, AgentVersion, Execution]),
    forwardRef(() => ExecutionsModule),
    forwardRef(() => DeploymentsModule),
  ],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
