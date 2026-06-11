import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IDeploymentProvider, DeployConfig, DeployResult } from './deployment-provider.interface';
import { LocalDeploymentProvider } from './local.provider';
import { GcpDeploymentProvider } from './gcp.provider';
import { AwsDeploymentProvider } from './aws.provider';
import { AzureDeploymentProvider } from './azure.provider';

export type DeploymentProviderName = 'local' | 'gcp' | 'aws' | 'azure';

@Injectable()
export class DeploymentProviderFactory {
  private providers: Map<string, IDeploymentProvider>;

  constructor(
    private configService: ConfigService,
    private localProvider: LocalDeploymentProvider,
    private gcpProvider: GcpDeploymentProvider,
    private awsProvider: AwsDeploymentProvider,
    private azureProvider: AzureDeploymentProvider,
  ) {}

  private getProviderMap(): Map<string, IDeploymentProvider> {
    if (!this.providers) {
      this.providers = new Map<string, IDeploymentProvider>([
        ['local', this.localProvider],
        ['gcp', this.gcpProvider],
        ['aws', this.awsProvider],
        ['azure', this.azureProvider],
      ]);
    }
    return this.providers;
  }

  /**
   * Resolves the correct deployment provider from the agent's YAML definition.
   * Falls back to 'local' if provider is not specified or unrecognized.
   *
   * Agent YAML:
   *   spec:
   *     deployment:
   *       provider: aws   # aws | gcp | azure | local
   *       region: us-east-1
   */
  getProvider(definition: Record<string, any>): IDeploymentProvider {
    const providerName = definition?.spec?.deployment?.provider || 'local';
    const provider = this.getProviderMap().get(providerName);

    if (!provider) {
      console.warn(`Unknown deployment provider '${providerName}', falling back to 'local'`);
      return this.localProvider;
    }

    return provider;
  }

  getProviderByName(name: string): IDeploymentProvider {
    return this.getProviderMap().get(name) || this.localProvider;
  }

  listProviders(): string[] {
    return Array.from(this.getProviderMap().keys());
  }
}
