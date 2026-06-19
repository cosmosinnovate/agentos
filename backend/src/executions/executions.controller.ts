import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ExecutionsService } from './executions.service';

@ApiTags('executions')
@Controller('api/v1')
export class ExecutionsController {
  constructor(private readonly executionsService: ExecutionsService) {}

  @Get('executions')
  @ApiOperation({ summary: 'List recent executions across all agents' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(@Query('limit') limit?: string) {
    return this.executionsService.findAll(limit ? parseInt(limit) : 50);
  }

  @Get('executions/metrics')
  @ApiOperation({ summary: 'Global observability metrics' })
  getGlobalMetrics() {
    return this.executionsService.getGlobalMetrics();
  }

  @Get('executions/:id')
  @ApiOperation({ summary: 'Get execution details by ID' })
  findOne(@Param('id') id: string) {
    return this.executionsService.findOne(id);
  }

  @Get('providers')
  @ApiOperation({ summary: 'List all available model and deployment providers with config status' })
  async listProviders() {
    return {
      modelProviders: await this.executionsService.listAvailableProviders(),
    };
  }
}
