import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AgentVersion } from '../../agents/entities/agent-version.entity';

@Entity('agent_deployments')
export class AgentDeployment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'version_id' })
  versionId: string;

  @Column({ name: 'agent_id' })
  agentId: string;

  @ManyToOne(() => AgentVersion, (version) => version.deployments)
  @JoinColumn({ name: 'version_id' })
  version: AgentVersion;

  @Column({ default: 'production' })
  environment: string; // staging | production

  @Column({ name: 'deployment_status', default: 'PENDING' })
  deploymentStatus: string; // PENDING | IN_PROGRESS | ACTIVE | FAILED | ROLLED_BACK

  @Column({ name: 'endpoint_url', nullable: true })
  endpointUrl: string;

  @Column({ name: 'cloud_run_service', nullable: true })
  cloudRunService: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @CreateDateColumn({ name: 'deployed_at' })
  deployedAt: Date;
}
