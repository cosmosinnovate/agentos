import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { ProviderConfig } from './entities/provider-config.entity';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly algorithm = 'aes-256-cbc';
  private readonly encryptionKey: Buffer;

  constructor(
    @InjectRepository(ProviderConfig)
    private providerConfigRepo: Repository<ProviderConfig>,
    private configService: ConfigService,
  ) {
    const keyString = this.configService.get<string>('ENCRYPTION_KEY') || 'default_insecure_key_32_bytes_long';
    // Ensure key is exactly 32 bytes for aes-256-cbc
    this.encryptionKey = crypto.scryptSync(keyString, 'salt', 32);
  }

  private encrypt(text: string): { encrypted: string; iv: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return {
      encrypted,
      iv: iv.toString('hex'),
    };
  }

  private decrypt(encrypted: string, ivHex: string): string {
    try {
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      this.logger.error(`Decryption failed: ${err.message}`);
      return null;
    }
  }

  async getApiKey(providerName: string): Promise<string | null> {
    const config = await this.providerConfigRepo.findOne({ where: { providerName } });
    if (!config) return null;
    return this.decrypt(config.encryptedApiKey, config.iv);
  }

  async setApiKey(providerName: string, apiKey: string): Promise<void> {
    let config = await this.providerConfigRepo.findOne({ where: { providerName } });
    const { encrypted, iv } = this.encrypt(apiKey);

    if (config) {
      config.encryptedApiKey = encrypted;
      config.iv = iv;
    } else {
      config = this.providerConfigRepo.create({
        providerName,
        encryptedApiKey: encrypted,
        iv,
      });
    }

    await this.providerConfigRepo.save(config);
    this.logger.log(`API key updated for provider: ${providerName}`);
  }

  async isProviderConfigured(providerName: string): Promise<boolean> {
    const count = await this.providerConfigRepo.count({ where: { providerName } });
    return count > 0;
  }

  async listConfiguredProviders(): Promise<string[]> {
    const configs = await this.providerConfigRepo.find({ select: ['providerName'] });
    return configs.map(c => c.providerName);
  }

  async deleteApiKey(providerName: string): Promise<void> {
    await this.providerConfigRepo.delete({ providerName });
    this.logger.log(`API key deleted for provider: ${providerName}`);
  }
}
