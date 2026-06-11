import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IDeploymentProvider, DeployConfig, DeployResult } from './deployment-provider.interface';

/**
 * GCP Cloud Run deployment provider.
 * Requires: GCP_PROJECT_ID, GCP_REGION env vars + Application Default Credentials.
 */
@Injectable()
export class GcpDeploymentProvider implements IDeploymentProvider {
  readonly providerName = 'gcp';
  private readonly logger = new Logger(GcpDeploymentProvider.name);

  constructor(private configService: ConfigService) {}

  async deploy(config: DeployConfig): Promise<DeployResult> {
    const projectId = this.configService.get('GCP_PROJECT_ID');
    const region = config.region || this.configService.get('GCP_REGION', 'us-central1');

    if (!projectId) {
      return {
        success: false,
        serviceName: config.serviceName,
        error: 'GCP_PROJECT_ID is not configured. Set it in your .env file.',
      };
    }

    try {
      this.logger.log(`[GCP] Deploying ${config.serviceName} to Cloud Run (${region})`);

      // Dynamic import — only loads if @google-cloud/run is installed
      const { ServicesClient } = await import('@google-cloud/run').catch(() => {
        throw new Error('Package @google-cloud/run is not installed. Run: npm install @google-cloud/run');
      });

      const client = new ServicesClient();
      const parent = `projects/${projectId}/locations/${region}`;
      const serviceName = `${parent}/services/${config.serviceName}`;

      const scaling = config.definition.spec?.scaling || {};
      const image = this.configService.get('AGENT_RUNTIME_IMAGE', 'gcr.io/agentos/runtime:latest');

      const serviceSpec = {
        name: serviceName,
        template: {
          containers: [
            {
              image,
              env: [
                { name: 'AGENT_ID', value: config.agentId },
                { name: 'AGENT_DEFINITION', value: JSON.stringify(config.definition) },
                { name: 'AGENTOS_BACKEND_URL', value: this.configService.get('BACKEND_URL', '') },
              ],
            },
          ],
          scaling: {
            minInstanceCount: scaling.minReplicas ?? 0,
            maxInstanceCount: scaling.maxReplicas ?? 10,
          },
        },
        ingress: 'INGRESS_TRAFFIC_ALL' as const,
      };

      // Upsert the service
      const [operation] = await client.createService({ parent, service: serviceSpec, serviceId: config.serviceName })
        .catch(() => client.updateService({ service: serviceSpec }));

      const [response] = await operation.promise();
      const serviceUrl = response?.uri || `https://${config.serviceName}-${projectId}.run.app`;

      this.logger.log(`[GCP] Deployment complete → ${serviceUrl}`);
      return { success: true, serviceUrl, serviceName: config.serviceName };
    } catch (error) {
      this.logger.error(`[GCP] Deployment failed: ${error.message}`);
      return { success: false, serviceName: config.serviceName, error: error.message };
    }
  }

  async delete(serviceName: string, region?: string): Promise<void> {
    const projectId = this.configService.get('GCP_PROJECT_ID');
    const resolvedRegion = region || this.configService.get('GCP_REGION', 'us-central1');
    this.logger.log(`[GCP] Would delete Cloud Run service: projects/${projectId}/locations/${resolvedRegion}/services/${serviceName}`);
    // TODO: implement actual deletion via ServicesClient
  }

  async getStatus(serviceName: string, region?: string): Promise<string> {
    return 'UNKNOWN'; // TODO: poll Cloud Run service status
  }
}
