import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import { CreateAgentDto, CreateVersionDto, InvokeAgentDto } from './dto/agent.dto';
import { ExecutionsService } from '../executions/executions.service';

@ApiTags('agents')
@Controller('api/v1/agents')
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly executionsService: ExecutionsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new agent' })
  @ApiResponse({ status: 201, description: 'Agent created successfully' })
  @ApiResponse({ status: 409, description: 'Agent name already exists' })
  create(@Body() dto: CreateAgentDto) {
    return this.agentsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all agents' })
  findAll() {
    return this.agentsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get agent by ID' })
  @ApiParam({ name: 'id', description: 'Agent UUID' })
  findOne(@Param('id') id: string) {
    return this.agentsService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an agent' })
  remove(@Param('id') id: string) {
    return this.agentsService.remove(id);
  }

  // --- Versions ---

  @Post(':id/versions')
  @ApiOperation({ summary: 'Create a new version (upload YAML definition)' })
  @ApiParam({ name: 'id', description: 'Agent UUID' })
  createVersion(@Param('id') id: string, @Body() dto: CreateVersionDto) {
    return this.agentsService.createVersion(id, dto);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List all versions for an agent' })
  getVersions(@Param('id') id: string) {
    return this.agentsService.getVersions(id);
  }

  @Get(':id/versions/:version')
  @ApiOperation({ summary: 'Get a specific version' })
  getVersion(@Param('id') id: string, @Param('version') version: string) {
    return this.agentsService.getVersion(id, parseInt(version));
  }

  // --- Invocation ---

  @Post(':id/invoke')
  @ApiOperation({ summary: 'Invoke an agent synchronously' })
  @ApiParam({ name: 'id', description: 'Agent UUID' })
  @ApiResponse({ status: 200, description: 'Agent response with execution trace' })
  async invoke(@Param('id') id: string, @Body() dto: InvokeAgentDto) {
    return this.executionsService.invoke(id, dto);
  }

  // --- Metrics ---

  @Get(':id/metrics')
  @ApiOperation({ summary: 'Get aggregated metrics for an agent' })
  getMetrics(@Param('id') id: string) {
    return this.executionsService.getAgentMetrics(id);
  }

  @Get(':id/executions')
  @ApiOperation({ summary: 'Get recent executions for an agent' })
  getExecutions(@Param('id') id: string) {
    return this.executionsService.findByAgent(id);
  }
}
