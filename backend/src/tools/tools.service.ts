import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tool } from './entities/tool.entity';
import { CreateToolDto } from './dto/tool.dto';

@Injectable()
export class ToolsService {
  constructor(
    @InjectRepository(Tool)
    private toolRepo: Repository<Tool>,
  ) {}

  async onModuleInit() {
    await this.seedDefaultTools();
  }

  async create(dto: CreateToolDto): Promise<Tool> {
    const existing = await this.toolRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException(`Tool '${dto.name}' already exists`);

    const tool = this.toolRepo.create({
      name: dto.name,
      description: dto.description,
      protocol: dto.protocol,
      endpoint: dto.endpoint,
      config: dto.config,
    });
    return this.toolRepo.save(tool);
  }

  async findAll(): Promise<Tool[]> {
    return this.toolRepo.find({ order: { createdAt: 'ASC' } });
  }

  async findOne(id: string): Promise<Tool> {
    const tool = await this.toolRepo.findOne({ where: { id } });
    if (!tool) throw new NotFoundException(`Tool '${id}' not found`);
    return tool;
  }

  async remove(id: string): Promise<void> {
    const tool = await this.findOne(id);
    await this.toolRepo.remove(tool);
  }

  private async seedDefaultTools(): Promise<void> {
    const defaults = [
      {
        name: 'web-search',
        description: 'Search the web for current information',
        protocol: 'MCP',
        endpoint: 'https://tools.agentos.io/mcp/web-search',
      },
      {
        name: 'weather',
        description: 'Get current weather and forecasts',
        protocol: 'MCP',
        endpoint: 'https://tools.agentos.io/mcp/weather',
      },
      {
        name: 'calculator',
        description: 'Perform mathematical calculations',
        protocol: 'MCP',
        endpoint: 'https://tools.agentos.io/mcp/calculator',
      },
      {
        name: 'postgres',
        description: 'Query PostgreSQL databases',
        protocol: 'MCP',
        endpoint: 'https://tools.agentos.io/mcp/postgres',
      },
      {
        name: 'slack',
        description: 'Send Slack messages and notifications',
        protocol: 'REST',
        endpoint: 'https://hooks.slack.com/services',
      },
    ];

    for (const tool of defaults) {
      const existing = await this.toolRepo.findOne({ where: { name: tool.name } });
      if (!existing) {
        await this.toolRepo.save(this.toolRepo.create(tool));
      }
    }
  }
}
