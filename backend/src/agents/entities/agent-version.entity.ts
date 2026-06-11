import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Agent } from './agent.entity';
import { AgentDeployment } from '../../deployments/entities/agent-deployment.entity';

@Entity('agent_versions')
export class AgentVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'agent_id' })
  agentId: string;

  @ManyToOne(() => Agent, (agent) => agent.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;

  @Column()
  version: number;

  @Column({ type: 'jsonb' })
  definition: Record<string, any>;

  @Column({ default: 'DRAFT' })
  status: string; // DRAFT | ACTIVE | DEPRECATED | ROLLBACK

  @Column({ type: 'text', nullable: true })
  changelog: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => AgentDeployment, (deployment) => deployment.version)
  deployments: AgentDeployment[];
}
