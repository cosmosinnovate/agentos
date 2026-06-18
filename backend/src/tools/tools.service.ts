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

  async findByName(name: string): Promise<Tool | null> {
    return this.toolRepo.findOne({ where: { name } });
  }

  async remove(id: string): Promise<void> {
    const tool = await this.findOne(id);
    await this.toolRepo.remove(tool);
  }
}
