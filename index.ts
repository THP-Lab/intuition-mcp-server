#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { Request, Response } from 'express';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { randomUUID } from 'node:crypto';
import * as triples from './operations/triples.js';
import { atomSearchOperation } from './operations/search-atoms.js';
import { getAccountInfoOperation } from './operations/get-account-info.js';
import { searchListsOperation } from './operations/search-lists.js';
import { getFollowingOperation } from './operations/get-following.js';
import { getFollowersOperation } from './operations/get-followers.js';
import { searchAccountIdsOperation } from './operations/search-account-ids.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { getTriplesByIdsOperation } from './operations/get-triples-by-id.js';
import { getOutgoingEdgesOperation } from "./operations/get-outgoing-edges.js";
import { getTriplesWithPositionsOperation } from './operations/get-triples-with-positions.js';


// Configure global error handlers with detailed logging
process.on('uncaughtException', (error) => {
  console.error('\n=== Uncaught Exception ===');
  console.error('Error:', error);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n=== Unhandled Rejection ===');
  console.error('Promise:', promise);
  console.error('Reason:', reason);
});

// Add debug logging
const debug = (...args: any[]) => {
  console.error('\n=== MCP Server Debug ===');
  console.error(...args);
};

// Define available tools once
const TOOLS = [
  {
    name: 'extract_triples',
    description: 'Extract triples from user input',
    inputSchema: zodToJsonSchema(triples.ExtractTriplesSchema),
  },
  {
    name: 'search_atoms',
    description: atomSearchOperation.description,
    inputSchema: zodToJsonSchema(atomSearchOperation.parameters),
  },
  {
    name: 'get_account_info',
    description: getAccountInfoOperation.description,
    inputSchema: zodToJsonSchema(getAccountInfoOperation.parameters),
  },
  {
    name: 'search_lists',
    description: searchListsOperation.description,
    inputSchema: zodToJsonSchema(searchListsOperation.parameters),
  },
  {
    name: 'get_following',
    description: getFollowingOperation.description,
    inputSchema: zodToJsonSchema(getFollowingOperation.parameters),
  },
  {
    name: 'get_followers',
    description: getFollowersOperation.description,
    inputSchema: zodToJsonSchema(getFollowersOperation.parameters),
  },
  {
    name: "get_outgoing_edges",
    description: getOutgoingEdgesOperation.description,
    inputSchema: zodToJsonSchema(getOutgoingEdgesOperation.parameters),
  },
  {
    name: 'search_account_ids',
    description: searchAccountIdsOperation.description,
    inputSchema: zodToJsonSchema(searchAccountIdsOperation.parameters),
  },
  {
    name: 'get_triples_by_ids',
    description: getTriplesByIdsOperation.description,
    inputSchema: zodToJsonSchema(getTriplesByIdsOperation.parameters),
  },
  {
  name: 'get_triples_with_positions',
  description: getTriplesWithPositionsOperation.description,
  inputSchema: zodToJsonSchema(getTriplesWithPositionsOperation.parameters),
  },
] as const;

// Store transports for each session type
const transports = {
  streamable: {} as Record<string, StreamableHTTPServerTransport>,
  sse: {} as Record<string, SSEServerTransport>,
};

// Create server instance with configuration
const SERVER_CONFIG = {
  name: 'intuition-mcp-server',
  version: '0.1.0',
} as const;

// Request tracing middleware
const tracingMiddleware = (req: Request, res: Response, next: Function) => {
  const requestId = randomUUID();
  const cfRay = req.headers['cf-ray'] as string;

  // Add Render tracing headers (or for any other host provider)
  res.setHeader('Rndr-Id', requestId);

  // Attach to request for logging
  (req as any).tracingInfo = {
    requestId,
    cfRay,
    startTime: Date.now(),
  };

  console.log(
    `[Request Start] ID: ${requestId} CF-Ray: ${cfRay} Session: ${req.headers['mcp-session-id']}`
  );
  next();
};

const server = new Server(SERVER_CONFIG, {
  capabilities: {
    tools: {
      extract_triples: true,
      search_atoms: true,
      get_account_info: true,
      search_lists: true,
      get_following: true,
      get_followers: true,
      search_account_ids: true,
      get_triples_by_ids: true,
      get_triples_with_positions: true,
    },
  },
});

// Set up request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  debug('Number of tools registered:', TOOLS.length);
  TOOLS.forEach((tool) => {
    debug(`- ${tool.name}: ${tool.description}`);
  });

  return { tools: TOOLS };
});

server.setRequestHandler(
  CallToolRequestSchema,
  async (request: CallToolRequest) => {
    debug('Tool Call Request:', request.params.name);
    debug('Arguments:', JSON.stringify(request.params.arguments, null, 2));

    try {
      if (!request.params.arguments) {
        throw new Error('Arguments are required');
      }

      switch (request.params.name) {
        case 'extract_triples': {
          const args = triples.ExtractTriplesSchema.parse(
            request.params.arguments
          );
          const result = await triples.extractTriples(args.input);
          return {
            _meta: {},
            content: [
              {
                type: 'text' as const,
                text: 'Extracted triples',
                data: result,
              },
            ],
          };
        }
        case 'search_atoms': {
          const args = atomSearchOperation.parameters.parse(
            request.params.arguments
          );
          return await atomSearchOperation.execute(args);
        }
        case 'get_account_info': {
          const args = getAccountInfoOperation.parameters.parse(
            request.params.arguments
          );
          return await getAccountInfoOperation.execute(args);
        }
        case 'search_lists': {
          const args = searchListsOperation.parameters.parse(
            request.params.arguments
          );
          return await searchListsOperation.execute(args);
        }
        case 'get_following': {
          const args = getFollowingOperation.parameters.parse(
            request.params.arguments
          );
          return await getFollowingOperation.execute(args);
        }
        case 'get_followers': {
          const args = getFollowersOperation.parameters.parse(
            request.params.arguments
          );
          return await getFollowersOperation.execute(args);
        }
        case 'search_account_ids': {
          const args = searchAccountIdsOperation.parameters.parse(
            request.params.arguments
          );
          return await searchAccountIdsOperation.execute(args);
        }
        case "get_outgoing_edges": {
          const args = getOutgoingEdgesOperation.parameters.parse(
            request.params.arguments,
          );
          return await getOutgoingEdgesOperation.execute(args);
        }
        case 'get_triples_by_ids': {
          const args = getTriplesByIdsOperation.parameters.parse(
            request.params.arguments
          );
          return await getTriplesByIdsOperation.execute(args);
        }
        case 'get_triples_with_positions': {
          const args = getTriplesWithPositionsOperation.parameters.parse(
            request.params.arguments
          );
          return await getTriplesWithPositionsOperation.execute(args);
        }
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    } catch (error) {
      debug('Tool Call Error:', error);
      return {
        _meta: {},
        content: [
          {
            type: 'text' as const,
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  }
);

async function runStdioServer() {
  debug('Starting MCP Server with stdio transport');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  debug('Server initialized and connected via stdio');
}

async function runHttpServer() {
  const app = express();
  const port = process.env.PORT || 3001;
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      version: SERVER_CONFIG.version,
      name: SERVER_CONFIG.name,
    });
  });

  // Modern Streamable HTTP endpoint
  app.all('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    try {
      if (!sessionId) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });
        if (transport.sessionId) {
          transports.streamable[transport.sessionId] = transport;
          await server.connect(transport);
          await transport.handleRequest(req, res, req.body);
        }
        return;
      }

      const transport = transports.streamable[sessionId];
      if (!transport) {
        res.status(401).json({
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: 'Invalid session, please reinitialize',
          },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('[Error]', error);
      if (!res.writableEnded) {
        res.status(500).json({
          error: 'Failed to handle connection',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  });

  // Legacy SSE endpoint for older clients
  app.get('/sse', async (req, res) => {
    const transport = new SSEServerTransport('/messages', res);
    transports.sse[transport.sessionId] = transport;

    res.on('close', () => {
      delete transports.sse[transport.sessionId];
    });

    await server.connect(transport);
  });

  // Legacy message endpoint for older clients
  app.post('/messages', async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.sse[sessionId];
    if (transport) {
      await transport.handlePostMessage(req, res, req.body);
    } else {
      res.status(400).send('No transport found for sessionId');
    }
  });

  const httpServer = app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    httpServer.close(() => {
      console.log('Server closed');
      process.exit(0);
    });

    // Force close after 10s
    setTimeout(() => {
      console.log('Forcing server shutdown');
      process.exit(1);
    }, 10000);
  });
}

// Determine server mode from environment variable
const serverMode = process.env.SERVER_MODE || 'stdio';

if (serverMode === 'http') {
  runHttpServer().catch((error) => {
    console.error('Fatal HTTP server error:', error);
    process.exit(1);
  });
} else {
  runStdioServer().catch((error) => {
    console.error('Fatal stdio server error:', error);
    process.exit(1);
  });
}
