import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IDeploymentProvider, DeployConfig, DeployResult } from './deployment-provider.interface';

/**
 * Local/Mock provider — simulates deployments instantly.
 * Used as the default when no cloud credentials are configured,
 * or when spec.deployment.provider = 'local'.
 */
@Injectable()
export class LocalDeploymentProvider implements IDeploymentProvider {
  readonly providerName = 'local';
  private readonly logger = new Logger(LocalDeploymentProvider.name);

  constructor(private configService: ConfigService) {}

  async deploy(config: DeployConfig): Promise<DeployResult> {
    this.logger.log(`[LOCAL] Simulating deployment: ${config.serviceName}`);
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 300));

    const backendUrl = this.configService.get('BACKEND_URL') || `http://localhost:${this.configService.get('PORT', '3001')}`;
    const serviceUrl = `${backendUrl.replace(/\/+$/, '')}/api/v1/agents/${config.agentId}/invoke`;

    this.logger.log(`[LOCAL] Deployment complete → ${serviceUrl}`);
    return { success: true, serviceUrl, serviceName: config.serviceName };
  }

  async delete(serviceName: string): Promise<void> {
    this.logger.log(`[LOCAL] Would stop local container: ${serviceName}`);
  }

  async getStatus(serviceName: string): Promise<string> {
    return 'ACTIVE';
  }
}
