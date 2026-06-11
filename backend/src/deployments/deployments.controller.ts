import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { DeploymentsService } from './deployments.service';
import { DeployAgentDto, RollbackDto } from './dto/deployment.dto';

@ApiTags('deployments')
@Controller('api/v1')
export class DeploymentsController {
  constructor(private readonly deploymentsService: DeploymentsService) {}

  @Get('deployments')
  @ApiOperation({ summary: 'List all deployments across all agents' })
  findAll() {
    return this.deploymentsService.findAll();
  }

  @Post('agents/:id/deploy')
  @ApiOperation({ summary: 'Deploy an agent to an environment' })
  @ApiParam({ name: 'id', description: 'Agent UUID' })
  deploy(@Param('id') id: string, @Body() dto: DeployAgentDto) {
    return this.deploymentsService.deploy(id, dto);
  }

  @Post('agents/:id/rollback')
  @ApiOperation({ summary: 'Rollback an agent to a previous version' })
  @ApiParam({ name: 'id', description: 'Agent UUID' })
  rollback(@Param('id') id: string, @Body() dto: RollbackDto) {
    return this.deploymentsService.rollback(id, dto);
  }

  @Get('agents/:id/deployments')
  @ApiOperation({ summary: 'Get deployment history for an agent' })
  getAgentDeployments(@Param('id') id: string) {
    return this.deploymentsService.findByAgent(id);
  }
}
