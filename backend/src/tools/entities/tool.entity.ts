import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToMany,
} from 'typeorm';

@Entity('tools')
export class Tool {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: 'MCP' })
  protocol: string; // MCP | REST

  @Column()
  endpoint: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
