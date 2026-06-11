import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Agent } from '../../agents/entities/agent.entity';

@Entity('executions')
export class Execution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'agent_id' })
  agentId: string;

  @ManyToOne(() => Agent)
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  @Column({ name: 'version_id', nullable: true })
  versionId: string;

  @Column({ name: 'request_payload', type: 'jsonb', nullable: true })
  requestPayload: Record<string, any>;

  @Column({ name: 'response_payload', type: 'jsonb', nullable: true })
  responsePayload: Record<string, any>;

  @Column({ name: 'latency_ms', nullable: true })
  latencyMs: number;

  @Column({ name: 'tokens_prompt', nullable: true })
  tokensPrompt: number;

  @Column({ name: 'tokens_completion', nullable: true })
  tokensCompletion: number;

  @Column({ name: 'total_cost', type: 'decimal', precision: 10, scale: 6, nullable: true })
  totalCost: number;

  @Column({ default: 'SUCCESS' })
  status: string; // SUCCESS | FAILED | RUNNING

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ nullable: true })
  model: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
