import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CloudRunDeployResult {
  serviceUrl: string;
  serviceName: string;
  success: boolean;
  error?: string;
}

@Injectable()
export class CloudRunService {
  private readonly logger = new Logger(CloudRunService.name);
  private readonly mockMode: boolean;

  constructor(private configService: ConfigService) {
    this.mockMode =
      configService.get('MOCK_MODE', 'true') === 'true' ||
      !configService.get('GCP_PROJECT_ID');
  }

  async deployService(
    agentName: string,
    versionId: string,
    definition: Record<string, any>,
    environment: string,
  ): Promise<CloudRunDeployResult> {
    const serviceName = `agentos-${agentName}-${environment}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    if (this.mockMode) {
      return this.mockDeploy(serviceName, agentName, environment);
    }

    return this.realDeploy(serviceName, agentName, versionId, definition, environment);
  }

  async deleteService(serviceName: string): Promise<void> {
    if (this.mockMode) {
      this.logger.log(`[MOCK] Would delete Cloud Run service: ${serviceName}`);
      return;
    }
    // Real GCP deletion would go here
    this.logger.log(`Deleting Cloud Run service: ${serviceName}`);
  }

  private async mockDeploy(
    serviceName: string,
    agentName: string,
    environment: string,
  ): Promise<CloudRunDeployResult> {
    this.logger.log(`[MOCK] Simulating Cloud Run deployment: ${serviceName}`);

    // Simulate deployment delay (500ms)
    await new Promise((resolve) => setTimeout(resolve, 500));

    const projectId = this.configService.get('GCP_PROJECT_ID', 'mock-project');
    const region = this.configService.get('GCP_REGION', 'us-central1');
    const serviceUrl = `https://${serviceName}-abc123-uc.a.run.app`;

    this.logger.log(`[MOCK] Deployment successful: ${serviceUrl}`);

    return {
      serviceUrl,
      serviceName,
      success: true,
    };
  }

  private async realDeploy(
    serviceName: string,
    agentName: string,
    versionId: string,
    definition: Record<string, any>,
    environment: string,
  ): Promise<CloudRunDeployResult> {
    // In production: use @google-cloud/run REST client
    // This is a placeholder for actual GCP Cloud Run API calls
    try {
      const projectId = this.configService.get('GCP_PROJECT_ID');
      const region = this.configService.get('GCP_REGION', 'us-central1');

      this.logger.log(`Deploying to Cloud Run: project=${projectId}, region=${region}, service=${serviceName}`);

      // TODO: Implement real GCP Cloud Run deployment
      // const { ServicesClient } = require('@google-cloud/run').v2;
      // const client = new ServicesClient();
      // ... create/update service

      throw new Error('Real GCP deployment not yet configured. Set MOCK_MODE=true to use mock adapter.');
    } catch (error) {
      return {
        serviceUrl: null,
        serviceName,
        success: false,
        error: error.message,
      };
    }
  }
}
