import { Injectable, NotFoundException, ConflictException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as yaml from 'js-yaml';
import { Agent } from './entities/agent.entity';
import { AgentVersion } from './entities/agent-version.entity';
import { Execution } from '../executions/entities/execution.entity';
import { CreateAgentDto, CreateVersionDto } from './dto/agent.dto';
import { DeploymentsService } from '../deployments/deployments.service';

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(Agent)
    private agentRepo: Repository<Agent>,
    @InjectRepository(AgentVersion)
    private versionRepo: Repository<AgentVersion>,
    @InjectRepository(Execution)
    private executionRepo: Repository<Execution>,
    @Inject(forwardRef(() => DeploymentsService))
    private deploymentsService: DeploymentsService,
  ) {}

  async create(dto: CreateAgentDto): Promise<Agent> {
    const existing = await this.agentRepo.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException(`Agent with name '${dto.name}' already exists`);
    }
    const agent = this.agentRepo.create({
      name: dto.name,
      description: dto.description,
      owner: dto.owner || 'system',
      status: 'inactive',
    });
    return this.agentRepo.save(agent);
  }

  async findAll(): Promise<Agent[]> {
    return this.agentRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Agent> {
    const agent = await this.agentRepo.findOne({
      where: { id },
      relations: ['versions'],
    });
    if (!agent) throw new NotFoundException(`Agent '${id}' not found`);
    return agent;
  }

  async findByName(name: string): Promise<Agent> {
    const agent = await this.agentRepo.findOne({
      where: { name },
      relations: ['versions'],
    });
    if (!agent) throw new NotFoundException(`Agent '${name}' not found`);
    return agent;
  }

  async remove(id: string): Promise<void> {
    const agent = await this.findOne(id);
    await this.deploymentsService.deleteDeploymentsForAgent(id);
    await this.executionRepo.delete({ agentId: id });
    await this.agentRepo.remove(agent);
  }

  async createVersion(agentId: string, dto: CreateVersionDto): Promise<AgentVersion> {
    const agent = await this.findOne(agentId);

    // Parse and validate YAML
    let definition: Record<string, any>;
    try {
      definition = yaml.load(dto.definition) as Record<string, any>;
    } catch (e) {
      throw new BadRequestException(`Invalid YAML: ${e.message}`);
    }

    // Validate required fields
    this.validateDefinition(definition);

    // Get next version number
    const latest = await this.versionRepo.findOne({
      where: { agentId },
      order: { version: 'DESC' },
    });
    const nextVersion = latest ? latest.version + 1 : 1;

    // Mark previous versions as DEPRECATED
    if (latest) {
      await this.versionRepo.update({ agentId, status: 'ACTIVE' }, { status: 'DEPRECATED' });
    }

    const version = this.versionRepo.create({
      agentId,
      version: nextVersion,
      definition,
      status: 'ACTIVE',
      changelog: dto.changelog,
    });

    const saved = await this.versionRepo.save(version);
    await this.agentRepo.update(agentId, { status: 'inactive' });
    return saved;
  }

  async getVersions(agentId: string): Promise<AgentVersion[]> {
    await this.findOne(agentId); // ensure agent exists
    return this.versionRepo.find({
      where: { agentId },
      order: { version: 'DESC' },
    });
  }

  async getVersion(agentId: string, versionNumber: number): Promise<AgentVersion> {
    const version = await this.versionRepo.findOne({
      where: { agentId, version: versionNumber },
    });
    if (!version) throw new NotFoundException(`Version ${versionNumber} not found for agent ${agentId}`);
    return version;
  }

  async getLatestVersion(agentId: string): Promise<AgentVersion> {
    const version = await this.versionRepo.findOne({
      where: { agentId, status: 'ACTIVE' },
      order: { version: 'DESC' },
    });
    if (!version) throw new NotFoundException(`No active version found for agent ${agentId}`);
    return version;
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.agentRepo.update(id, { status });
  }

  private validateDefinition(definition: Record<string, any>): void {
    if (!definition.apiVersion) {
      throw new BadRequestException('Missing required field: apiVersion');
    }
    if (!definition.kind || definition.kind !== 'Agent') {
      throw new BadRequestException('Missing or invalid field: kind (must be "Agent")');
    }
    if (!definition.metadata?.name) {
      throw new BadRequestException('Missing required field: metadata.name');
    }
    if (!definition.spec?.model?.provider) {
      throw new BadRequestException('Missing required field: spec.model.provider');
    }
    if (!definition.spec?.model?.name) {
      throw new BadRequestException('Missing required field: spec.model.name');
    }
  }
}
