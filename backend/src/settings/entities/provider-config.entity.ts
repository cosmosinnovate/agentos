import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('provider_configs')
export class ProviderConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'provider_name', unique: true })
  providerName: string;

  @Column({ name: 'encrypted_api_key', type: 'text' })
  encryptedApiKey: string;

  @Column({ type: 'text' })
  iv: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
