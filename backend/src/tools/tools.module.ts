import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ToolsController } from './tools.controller';
import { ToolsService } from './tools.service';
import { Tool } from './entities/tool.entity';
import { AgentTool } from './entities/agent-tool.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Tool, AgentTool])],
  controllers: [ToolsController],
  providers: [ToolsService],
  exports: [ToolsService],
})
export class ToolsModule {}
