import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class McpClientService {
  private readonly logger = new Logger(McpClientService.name);

  /**
   * Invokes an external MCP tool via HTTP.
   * Supports both root endpoints (e.g. http://localhost:8088) and direct URLs (e.g. http://localhost:8088/tools/call).
   *
   * @param endpointUrl The configured base URL or tool call URL.
   * @param toolName The name of the tool to execute.
   * @param args The input arguments mapping.
   */
  async callMcpTool(endpointUrl: string, toolName: string, args: Record<string, any>): Promise<any> {
    const base = endpointUrl.replace(/\/+$/, '');
    let callUrl = base;

    if (!base.endsWith('/tools/call')) {
      callUrl = `${base}/tools/call`;
    }

    this.logger.log(`[MCP Client] Invoking tool '${toolName}' at: ${callUrl}`);
    this.logger.log(`[MCP Client] Arguments: ${JSON.stringify(args)}`);

    try {
      const response = await fetch(callUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          name: toolName,
          arguments: args,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`MCP Server returned status ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      this.logger.log(`[MCP Client] Success: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(`[MCP Client] Failure invoking tool '${toolName}': ${error.message}`);
      throw new Error(`Failed to execute MCP tool '${toolName}' at ${callUrl}: ${error.message}`);
    }
  }
}
