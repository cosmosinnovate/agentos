export interface DeployConfig {
  serviceName: string;
  agentName: string;
  agentId: string;
  versionId: string;
  definition: Record<string, any>;
  environment: string;
  region?: string;
  minReplicas?: number;
  maxReplicas?: number;
}

export interface DeployResult {
  success: boolean;
  serviceUrl?: string;
  serviceName: string;
  error?: string;
}

export interface IDeploymentProvider {
  readonly providerName: string;
  deploy(config: DeployConfig): Promise<DeployResult>;
  delete(serviceName: string, region?: string): Promise<void>;
  getStatus(serviceName: string, region?: string): Promise<string>;
}
