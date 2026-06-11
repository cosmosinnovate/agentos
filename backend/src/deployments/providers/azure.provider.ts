import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IDeploymentProvider, DeployConfig, DeployResult } from './deployment-provider.interface';

/**
 * Azure Container Apps deployment provider.
 * Requires: AZURE_SUBSCRIPTION_ID, AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET env vars.
 */
@Injectable()
export class AzureDeploymentProvider implements IDeploymentProvider {
  readonly providerName = 'azure';
  private readonly logger = new Logger(AzureDeploymentProvider.name);

  constructor(private configService: ConfigService) {}

  async deploy(config: DeployConfig): Promise<DeployResult> {
    const subscriptionId = this.configService.get('AZURE_SUBSCRIPTION_ID');
    const tenantId = this.configService.get('AZURE_TENANT_ID');
    const clientId = this.configService.get('AZURE_CLIENT_ID');
    const clientSecret = this.configService.get('AZURE_CLIENT_SECRET');

    if (!subscriptionId || !tenantId || !clientId || !clientSecret) {
      return {
        success: false,
        serviceName: config.serviceName,
        error:
          'Azure credentials not configured. Set AZURE_SUBSCRIPTION_ID, AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET in your .env file.',
      };
    }

    try {
      this.logger.log(`[Azure] Deploying ${config.serviceName} to Container Apps`);

      const { ContainerAppsAPIClient } = await import('@azure/arm-appcontainers').catch(() => {
        throw new Error(
          'Package @azure/arm-appcontainers is not installed. Run: npm install @azure/arm-appcontainers @azure/identity',
        );
      });

      const { ClientSecretCredential } = await import('@azure/identity').catch(() => {
        throw new Error('Package @azure/identity is not installed. Run: npm install @azure/identity');
      });

      const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
      const client = new ContainerAppsAPIClient(credential, subscriptionId);

      const resourceGroup = this.configService.get('AZURE_RESOURCE_GROUP', 'agentos-rg');
      const containerEnv = this.configService.get('AZURE_CONTAINER_ENV', 'agentos-env');
      const image = this.configService.get('AGENT_RUNTIME_IMAGE', 'docker.io/agentos/runtime:latest');
      const scaling = config.definition.spec?.scaling || {};

      const result = await client.containerApps.beginCreateOrUpdateAndWait(
        resourceGroup,
        config.serviceName,
        {
          location: config.region || this.configService.get('AZURE_REGION', 'eastus'),
          managedEnvironmentId: `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.App/managedEnvironments/${containerEnv}`,
          template: {
            containers: [
              {
                name: 'agent',
                image,
                env: [
                  { name: 'AGENT_ID', value: config.agentId },
                  { name: 'AGENT_DEFINITION', value: JSON.stringify(config.definition) },
                ],
              },
            ],
            scale: {
              minReplicas: scaling.minReplicas ?? 0,
              maxReplicas: scaling.maxReplicas ?? 10,
            },
          },
        },
      );

      const serviceUrl = result.latestRevisionFqdn
        ? `https://${result.latestRevisionFqdn}`
        : `https://${config.serviceName}.${config.region || 'eastus'}.azurecontainerapps.io`;

      this.logger.log(`[Azure] Deployment complete → ${serviceUrl}`);
      return { success: true, serviceUrl, serviceName: config.serviceName };
    } catch (error) {
      this.logger.error(`[Azure] Deployment failed: ${error.message}`);
      return { success: false, serviceName: config.serviceName, error: error.message };
    }
  }

  async delete(serviceName: string): Promise<void> {
    this.logger.log(`[Azure] Would delete Container App: ${serviceName}`);
  }

  async getStatus(serviceName: string): Promise<string> {
    return 'UNKNOWN';
  }
}
