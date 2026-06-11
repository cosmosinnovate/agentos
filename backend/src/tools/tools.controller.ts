import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ToolsService } from './tools.service';
import { CreateToolDto } from './dto/tool.dto';

@ApiTags('tools')
@Controller('api/v1/tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Get()
  @ApiOperation({ summary: 'List all available tools' })
  findAll() {
    return this.toolsService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Register a new tool' })
  create(@Body() dto: CreateToolDto) {
    return this.toolsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tool by ID' })
  findOne(@Param('id') id: string) {
    return this.toolsService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a tool' })
  remove(@Param('id') id: string) {
    return this.toolsService.remove(id);
  }
}
