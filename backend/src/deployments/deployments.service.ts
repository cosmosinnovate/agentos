import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentDeployment } from './entities/agent-deployment.entity';
import { AgentsService } from '../agents/agents.service';
import { DeploymentProviderFactory } from './providers/deployment-provider.factory';
import { DeployAgentDto, RollbackDto } from './dto/deployment.dto';

@Injectable()
export class DeploymentsService {
  constructor(
    @InjectRepository(AgentDeployment)
    private deploymentRepo: Repository<AgentDeployment>,
    @Inject(forwardRef(() => AgentsService))
    private agentsService: AgentsService,
    private providerFactory: DeploymentProviderFactory,
  ) {}

  async deploy(agentId: string, dto: DeployAgentDto): Promise<AgentDeployment> {
    const agent = await this.agentsService.findOne(agentId);
    const environment = dto.environment || 'production';

    let version;
    if (dto.versionNumber) {
      version = await this.agentsService.getVersion(agentId, dto.versionNumber);
    } else {
      version = await this.agentsService.getLatestVersion(agentId);
    }

    const definition = version.definition;
    const providerName = definition?.spec?.deployment?.provider || 'local';
    const region = definition?.spec?.deployment?.region;

    // Create pending deployment record
    const deployment = this.deploymentRepo.create({
      versionId: version.id,
      agentId,
      environment,
      deploymentStatus: 'IN_PROGRESS',
    });
    const saved = await this.deploymentRepo.save(deployment);

    try {
      await this.agentsService.updateStatus(agentId, 'deploying');

      // Resolve provider from YAML definition
      const provider = this.providerFactory.getProvider(definition);
      const serviceName = `agentos-${agent.name}-${environment}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

      const result = await provider.deploy({
        serviceName,
        agentName: agent.name,
        agentId,
        versionId: version.id,
        definition,
        environment,
        region,
        minReplicas: definition?.spec?.scaling?.minReplicas,
        maxReplicas: definition?.spec?.scaling?.maxReplicas,
      });

      if (result.success) {
        await this.deploymentRepo.update(saved.id, {
          deploymentStatus: 'ACTIVE',
          endpointUrl: result.serviceUrl,
          cloudRunService: result.serviceName,
        });
        await this.agentsService.updateStatus(agentId, 'active');
      } else {
        await this.deploymentRepo.update(saved.id, {
          deploymentStatus: 'FAILED',
          errorMessage: result.error,
        });
        await this.agentsService.updateStatus(agentId, 'failed');
      }

      return this.deploymentRepo.findOne({ where: { id: saved.id } });
    } catch (error) {
      await this.deploymentRepo.update(saved.id, {
        deploymentStatus: 'FAILED',
        errorMessage: error.message,
      });
      await this.agentsService.updateStatus(agentId, 'failed');
      throw error;
    }
  }

  async rollback(agentId: string, dto: RollbackDto): Promise<AgentDeployment> {
    const agent = await this.agentsService.findOne(agentId);
    const version = await this.agentsService.getVersion(agentId, dto.versionNumber);
    const environment = dto.environment || 'production';
    const definition = version.definition;

    const deployment = this.deploymentRepo.create({
      versionId: version.id,
      agentId,
      environment,
      deploymentStatus: 'IN_PROGRESS',
    });
    const saved = await this.deploymentRepo.save(deployment);

    try {
      await this.agentsService.updateStatus(agentId, 'deploying');

      const provider = this.providerFactory.getProvider(definition);
      const serviceName = `agentos-${agent.name}-${environment}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

      const result = await provider.deploy({
        serviceName,
        agentName: agent.name,
        agentId,
        versionId: version.id,
        definition,
        environment,
        region: definition?.spec?.deployment?.region,
      });

      if (result.success) {
        await this.deploymentRepo.update(saved.id, {
          deploymentStatus: 'ACTIVE',
          endpointUrl: result.serviceUrl,
          cloudRunService: result.serviceName,
        });
        await this.agentsService.updateStatus(agentId, 'active');
      } else {
        await this.deploymentRepo.update(saved.id, {
          deploymentStatus: 'FAILED',
          errorMessage: result.error,
        });
        await this.agentsService.updateStatus(agentId, 'failed');
      }

      return this.deploymentRepo.findOne({ where: { id: saved.id } });
    } catch (error) {
      await this.deploymentRepo.update(saved.id, {
        deploymentStatus: 'FAILED',
        errorMessage: error.message,
      });
      throw error;
    }
  }

  async findAll(): Promise<AgentDeployment[]> {
    return this.deploymentRepo.find({ order: { deployedAt: 'DESC' }, take: 100 });
  }

  async findByAgent(agentId: string): Promise<AgentDeployment[]> {
    return this.deploymentRepo.find({ where: { agentId }, order: { deployedAt: 'DESC' } });
  }

  async getActiveDeployment(agentId: string): Promise<AgentDeployment | null> {
    return this.deploymentRepo.findOne({
      where: { agentId, deploymentStatus: 'ACTIVE' },
      order: { deployedAt: 'DESC' },
    });
  }

  listAvailableProviders(): string[] {
    return this.providerFactory.listProviders();
  }

  async deleteDeploymentsForAgent(agentId: string): Promise<void> {
    const deployments = await this.deploymentRepo.find({
      where: { agentId },
      relations: ['version'],
    });

    for (const dep of deployments) {
      if (dep.cloudRunService) {
        try {
          const providerName = dep.version?.definition?.spec?.deployment?.provider || 'local';
          const region = dep.version?.definition?.spec?.deployment?.region;
          const provider = this.providerFactory.getProviderByName(providerName);
          await provider.delete(dep.cloudRunService, region);
        } catch (error) {
          console.warn(`Failed to clean up cloud deployment ${dep.cloudRunService}: ${error.message}`);
        }
      }
    }

    await this.deploymentRepo.remove(deployments);
  }
}
