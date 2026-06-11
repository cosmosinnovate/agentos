import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class DeployAgentDto {
  @ApiPropertyOptional({ example: 'production', enum: ['staging', 'production'] })
  @IsOptional()
  @IsString()
  @IsIn(['staging', 'production'])
  environment?: string;

  @ApiPropertyOptional({ description: 'Specific version number to deploy (defaults to latest active)' })
  @IsOptional()
  versionNumber?: number;
}

export class RollbackDto {
  @ApiProperty({ description: 'Version number to roll back to' })
  versionNumber: number;

  @ApiPropertyOptional({ example: 'production', enum: ['staging', 'production'] })
  @IsOptional()
  environment?: string;
}
