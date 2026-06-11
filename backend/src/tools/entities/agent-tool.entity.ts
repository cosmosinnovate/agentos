import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('agent_tools')
export class AgentTool {
  @PrimaryColumn({ name: 'agent_id' })
  agentId: string;

  @PrimaryColumn({ name: 'tool_id' })
  toolId: string;
}
