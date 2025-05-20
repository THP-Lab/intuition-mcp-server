#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { Request, Response } from 'express';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolRequest,
  InitializeRequest,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { performance } from 'perf_hooks';
import { randomUUID } from 'node:crypto';

import * as triples from './operations/triples.js';
import { atomSearchOperation } from './operations/search-atoms.js';
import { getAccountInfoOperation } from './operations/get-account-info.js';
import { searchListsOperation } from './operations/search-lists.js';

import { getFollowingOperation } from './operations/get-following.js';
import { getFollowersOperation } from './operations/get-followers.js';

import { searchAccountIdsOperation } from './operations/search-account-ids.js';

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
    name: 'search_account_ids',
    description: searchAccountIdsOperation.description,
    inputSchema: zodToJsonSchema(searchAccountIdsOperation.parameters),
  },
] as const;

// Server metrics
interface ServerMetrics {
  totalConnections: number;
  activeConnections: number;
  messageLatencies: number[];
  lastCleanup: number;
}

const metrics: ServerMetrics = {
  totalConnections: 0,
  activeConnections: 0,
  messageLatencies: [],
  lastCleanup: Date.now(),
};

// Create server instance with configuration
const SERVER_CONFIG = {
  name: 'intuition-mcp-server',
  version: '0.0.1',
} as const;

const server = new Server(SERVER_CONFIG, {
  capabilities: {
    tools: {
      extract_triples: true,
      search_atoms: true,
      get_account_info: true,
      search_lists: true,
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

  // Store transports by session ID
  const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

  // Basic request logging
  app.use((req: Request, res: Response, next) => {
    debug(`${req.method} ${req.path}`);
    next();
  });

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    const recentLatencies = metrics.messageLatencies.slice(-100);
    const avgLatency =
      recentLatencies.length > 0
        ? recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length
        : 0;

    res.json({
      status: 'ok',
      version: SERVER_CONFIG.version,
      name: SERVER_CONFIG.name,
      metrics: {
        activeConnections: metrics.activeConnections,
        totalConnections: metrics.totalConnections,
        averageLatencyMs: Math.round(avgLatency),
        timeSinceLastCleanup: Date.now() - metrics.lastCleanup,
      },
    });
  });

  // Modern Streamable HTTP endpoint
  app.post('/mcp', async (req: Request, res: Response) => {
    const startTime = performance.now();
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    try {
      if (sessionId && transports[sessionId]) {
        // Reuse existing transport
        transport = transports[sessionId];
      } else if (!sessionId && req.body && req.body.method === 'initialize') {
        // New initialization request
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId) => {
            debug('New session initialized:', sessionId);
            metrics.totalConnections++;
            metrics.activeConnections++;
            transports[sessionId] = transport;
          },
        });

        // Clean up transport when closed
        transport.onclose = () => {
          if (transport.sessionId) {
            debug(`Session closed: ${transport.sessionId}`);
            metrics.activeConnections--;
            delete transports[transport.sessionId];
          }
        };

        await server.connect(transport);
      } else {
        // Invalid request
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        });
        return;
      }

      // Handle the request
      await transport.handleRequest(req, res, req.body);

      // Record latency
      const latency = performance.now() - startTime;
      metrics.messageLatencies.push(latency);
      if (metrics.messageLatencies.length > 1000) {
        metrics.messageLatencies.shift();
      }
    } catch (error) {
      debug('Error handling streamable HTTP connection:', error);
      if (!res.writableEnded) {
        res.status(500).json({
          error: 'Failed to handle connection',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  });

  // Reusable handler for GET and DELETE requests
  const handleSessionRequest = async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  };

  // Handle GET requests for server-to-client notifications
  app.get('/mcp', handleSessionRequest);

  // Handle DELETE requests for session termination
  app.delete('/mcp', handleSessionRequest);

  // Error handling middleware
  app.use((err: Error, req: Request, res: Response, next: Function) => {
    debug('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  const httpServer = app.listen(port, () => {
    debug(`HTTP server listening on port ${port}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    debug('SIGTERM received, shutting down gracefully');
    httpServer.close(() => {
      debug('Server closed');
      process.exit(0);
    });

    // Force close after 10s
    setTimeout(() => {
      debug('Forcing server shutdown');
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
