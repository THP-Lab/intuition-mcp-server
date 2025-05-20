import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';

// Create a class to manage MCP client lifecycle
class MCPClientManager {
  private static instance: MCPClientManager;
  private client: Client;
  private transport: StdioClientTransport | StreamableHTTPClientTransport;
  private tools: Tool[] = [];
  private initialized = false;

  private constructor() {
    const mcpHttpUrl = process.env.MCP_HTTP_URL;

    if (mcpHttpUrl) {
      const baseUrl = mcpHttpUrl.endsWith('/')
        ? mcpHttpUrl.slice(0, -1)
        : mcpHttpUrl;
      const fullUrl = `${baseUrl}/mcp`;
      console.log('Using StreamableHTTP transport with URL:', fullUrl);
      this.transport = new StreamableHTTPClientTransport(new URL(fullUrl));
    } else {
      console.log('Using stdio transport');
      this.transport = new StdioClientTransport({
        command: 'node',
        args: [`${process.cwd()}/../intuition-mcp-server/dist/index.js`],
      });
    }

    this.client = new Client(
      {
        name: 'intuition-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );
  }

  public static getInstance(): MCPClientManager {
    if (!MCPClientManager.instance) {
      MCPClientManager.instance = new MCPClientManager();
    }
    return MCPClientManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.client.connect(this.transport);
      const toolsResponse = await this.client.listTools();
      this.tools = toolsResponse.tools;
      this.initialized = true;

      console.log('\n=== Available MCP Tools ===');
      console.log(JSON.stringify(this.tools, null, 2));
    } catch (error) {
      console.error('Failed to initialize MCP client:', error);
      throw error;
    }
  }

  /**
   * Lists available tools from the MCP server
   * @returns A promise resolving to the tools available from the server
   */
  public async listTools(): Promise<{ tools: Tool[] }> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Get fresh tools list from server
      const toolsResponse = await this.client.listTools();
      // Update cached tools
      this.tools = toolsResponse.tools;
      return toolsResponse;
    } catch (error) {
      console.error('Failed to list MCP tools:', error);
      // Return cached tools if we have them, otherwise rethrow
      if (this.tools.length > 0) {
        return { tools: this.tools };
      }
      throw error;
    }
  }

  public async callTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<CallToolResult['content']> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      console.log('\n=== MCP Tool Call Start ===');
      console.log('Tool:', toolName);
      console.log('Arguments:', JSON.stringify(args, null, 2));

      const response = await this.client.callTool({
        name: toolName,
        arguments: args,
      });

      console.log('\n=== MCP Tool Call Result ===');
      console.log('Result:', JSON.stringify(response, null, 2));

      // Validate and transform the response
      const mcpResponse = response as CallToolResult;
      if (!mcpResponse || !Array.isArray(mcpResponse.content)) {
        throw new Error('Invalid MCP response format');
      }

      return mcpResponse.content;
    } catch (error) {
      console.error('\n=== MCP Tool Call Error ===');
      console.error('Tool:', toolName);
      console.error('Arguments:', JSON.stringify(args, null, 2));
      console.error('Error:', error);

      // Return error in MCP format
      return [
        {
          type: 'text',
          text: error instanceof Error ? error.message : String(error),
        },
      ];
    }
  }

  public async cleanup(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
    }
    this.initialized = false;
  }
}

// Create and export the singleton instance
const mcpClientManager = MCPClientManager.getInstance();

// Export the callTool function that uses the manager
const callTool = (toolName: string, args: Record<string, unknown>) =>
  mcpClientManager.callTool(toolName, args);

export { mcpClientManager as mcpClient, callTool };
