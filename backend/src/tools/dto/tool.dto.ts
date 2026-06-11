import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsIn, IsBoolean } from 'class-validator';

export class CreateToolDto {
  @ApiProperty({ example: 'web-search', description: 'Unique tool name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Searches the web using Google Search API' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'MCP', enum: ['MCP', 'REST'] })
  @IsString()
  @IsIn(['MCP', 'REST'])
  protocol: string;

  @ApiProperty({ example: 'https://tools.agentos.io/web-search' })
  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @ApiPropertyOptional({ description: 'Optional config JSON for the tool' })
  @IsOptional()
  config?: Record<string, any>;
}
