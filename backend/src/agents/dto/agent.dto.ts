import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateAgentDto {
  @ApiProperty({ example: 'research-agent', description: 'Unique kebab-case name for the agent' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, { message: 'Name must be lowercase letters, numbers, and hyphens only' })
  name: string;

  @ApiPropertyOptional({ example: 'Researches topics using web search and summarizes findings' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'developer@company.com' })
  @IsOptional()
  @IsString()
  owner?: string;
}

export class CreateVersionDto {
  @ApiProperty({
    example: `apiVersion: agentos/v1\nkind: Agent\nmetadata:\n  name: research-agent\nspec:\n  model:\n    provider: vertex\n    name: gemini-2.5-pro`,
    description: 'YAML definition of the agent spec',
  })
  @IsString()
  @IsNotEmpty()
  definition: string;

  @ApiPropertyOptional({ example: 'Updated model to gemini-2.5-pro' })
  @IsOptional()
  @IsString()
  changelog?: string;
}

export class InvokeAgentDto {
  @ApiProperty({ example: 'Research the latest trends in AI agent frameworks' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ description: 'Optional context or system prompt override' })
  @IsOptional()
  @IsString()
  context?: string;
}
