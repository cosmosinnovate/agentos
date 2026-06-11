import { Injectable, Logger } from '@nestjs/common';
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

  async deploy(config: DeployConfig): Promise<DeployResult> {
    this.logger.log(`[LOCAL] Simulating deployment: ${config.serviceName}`);
    await new Promise((r) => setTimeout(r, 400 + Math.random() * 300));

    const port = 8000 + Math.floor(Math.random() * 1000);
    const serviceUrl = `http://localhost:${port}`;

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
