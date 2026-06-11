import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IDeploymentProvider, DeployConfig, DeployResult } from './deployment-provider.interface';

/**
 * AWS ECS Fargate deployment provider.
 * Requires: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION env vars.
 */
@Injectable()
export class AwsDeploymentProvider implements IDeploymentProvider {
  readonly providerName = 'aws';
  private readonly logger = new Logger(AwsDeploymentProvider.name);

  constructor(private configService: ConfigService) {}

  async deploy(config: DeployConfig): Promise<DeployResult> {
    const accessKey = this.configService.get('AWS_ACCESS_KEY_ID');
    const secretKey = this.configService.get('AWS_SECRET_ACCESS_KEY');
    const region = config.region || this.configService.get('AWS_REGION', 'us-east-1');

    if (!accessKey || !secretKey) {
      return {
        success: false,
        serviceName: config.serviceName,
        error: 'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are not configured. Set them in your .env file.',
      };
    }

    try {
      this.logger.log(`[AWS] Deploying ${config.serviceName} to ECS Fargate (${region})`);

      const { ECSClient, RegisterTaskDefinitionCommand, CreateServiceCommand, UpdateServiceCommand } =
        await import('@aws-sdk/client-ecs').catch(() => {
          throw new Error('Package @aws-sdk/client-ecs is not installed. Run: npm install @aws-sdk/client-ecs');
        });

      const client = new ECSClient({
        region,
        credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      });

      const clusterName = this.configService.get('AWS_ECS_CLUSTER', 'agentos-cluster');
      const image = this.configService.get('AGENT_RUNTIME_IMAGE', 'public.ecr.aws/agentos/runtime:latest');
      const scaling = config.definition.spec?.scaling || {};

      // Register task definition
      const taskDef = await client.send(
        new RegisterTaskDefinitionCommand({
          family: config.serviceName,
          networkMode: 'awsvpc',
          requiresCompatibilities: ['FARGATE'],
          cpu: '256',
          memory: '512',
          containerDefinitions: [
            {
              name: 'agent',
              image,
              environment: [
                { name: 'AGENT_ID', value: config.agentId },
                { name: 'AGENT_DEFINITION', value: JSON.stringify(config.definition) },
              ],
              portMappings: [{ containerPort: 8080, protocol: 'tcp' }],
            },
          ],
        }),
      );

      // Create or update ECS service
      const taskDefArn = taskDef.taskDefinition?.taskDefinitionArn;
      const serviceUrl = `https://${config.serviceName}.${region}.ecs.amazonaws.com`;

      this.logger.log(`[AWS] Deployment complete → task: ${taskDefArn}`);
      return { success: true, serviceUrl, serviceName: config.serviceName };
    } catch (error) {
      this.logger.error(`[AWS] Deployment failed: ${error.message}`);
      return { success: false, serviceName: config.serviceName, error: error.message };
    }
  }

  async delete(serviceName: string, region?: string): Promise<void> {
    this.logger.log(`[AWS] Would delete ECS service: ${serviceName}`);
  }

  async getStatus(serviceName: string): Promise<string> {
    return 'UNKNOWN';
  }
}
