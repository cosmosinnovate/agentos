// Type stubs for optional cloud provider packages.
// These are loaded dynamically at runtime — only needed if you install and configure them.
// Install the packages you need:
//   npm install @google-cloud/run @aws-sdk/client-ecs @aws-sdk/client-bedrock-runtime @azure/arm-appcontainers @azure/identity @google-cloud/vertexai

declare module '@google-cloud/run' {
  export const v2: any;
  export const ServicesClient: any;
}

declare module '@aws-sdk/client-ecs' {
  export class ECSClient { constructor(config: any); send(command: any): Promise<any>; }
  export class RegisterTaskDefinitionCommand { constructor(input: any); }
  export class CreateServiceCommand { constructor(input: any); }
  export class UpdateServiceCommand { constructor(input: any); }
}

declare module '@aws-sdk/client-bedrock-runtime' {
  export class BedrockRuntimeClient { constructor(config: any); send(command: any): Promise<any>; }
  export class InvokeModelCommand { constructor(input: any); }
}

declare module '@azure/arm-appcontainers' {
  export class ContainerAppsAPIClient {
    constructor(credential: any, subscriptionId: string);
    containerApps: {
      beginCreateOrUpdateAndWait(resourceGroup: string, name: string, app: any): Promise<any>;
    };
  }
}

declare module '@azure/identity' {
  export class ClientSecretCredential {
    constructor(tenantId: string, clientId: string, clientSecret: string);
  }
}

declare module '@google-cloud/vertexai' {
  export class VertexAI {
    constructor(config: { project: string; location: string });
    getGenerativeModel(config: { model: string }): any;
  }
}
