#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express, { Request, Response } from "express";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import * as triples from "./operations/triples.js";
import { atomSearchOperation } from "./operations/search-atoms.js";
import { getAccountInfoOperation } from "./operations/get-account-info.js";
import { searchListsOperation } from "./operations/search-lists.js";

import { getFollowingOperation } from "./operations/get-following.js";
import { getFollowersOperation } from "./operations/get-followers.js";

import { searchAccountIdsOperation } from "./operations/search-account-ids.js";

// Configure global error handlers with detailed logging
process.on("uncaughtException", (error) => {
  console.error("\n=== Uncaught Exception ===");
  console.error("Error:", error);
  console.error("Stack:", error.stack);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("\n=== Unhandled Rejection ===");
  console.error("Promise:", promise);
  console.error("Reason:", reason);
});

// Add debug logging
const debug = (...args: any[]) => {
  console.error("\n=== MCP Server Debug ===");
  console.error(...args);
};

// Define available tools once
const TOOLS = [
  {
    name: "extract_triples",
    description: "Extract triples from user input",
    inputSchema: zodToJsonSchema(triples.ExtractTriplesSchema),
  },
  {
    name: "search_atoms",
    description: atomSearchOperation.description,
    inputSchema: zodToJsonSchema(atomSearchOperation.parameters),
  },
  {
    name: "get_account_info",
    description: getAccountInfoOperation.description,
    inputSchema: zodToJsonSchema(getAccountInfoOperation.parameters),
  },
  {
    name: "search_lists",
    description: searchListsOperation.description,
    inputSchema: zodToJsonSchema(searchListsOperation.parameters),
  },
  {
    name: "get_following",
    description: getFollowingOperation.description,
    inputSchema: zodToJsonSchema(getFollowingOperation.parameters),
  },
  {
    name: "get_followers",
    description: getFollowersOperation.description,
    inputSchema: zodToJsonSchema(getFollowersOperation.parameters),
  },
  {
    name: "search_account_ids",
    description: searchAccountIdsOperation.description,
    inputSchema: zodToJsonSchema(searchAccountIdsOperation.parameters),
  },
] as const;

// Create server instance with configuration
const SERVER_CONFIG = {
  name: "intuition-mcp-server",
  version: "0.0.1",
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
  debug("Number of tools registered:", TOOLS.length);
  TOOLS.forEach((tool) => {
    debug(`- ${tool.name}: ${tool.description}`);
  });

  return { tools: TOOLS };
});

server.setRequestHandler(
  CallToolRequestSchema,
  async (request: CallToolRequest) => {
    debug("Tool Call Request:", request.params.name);
    debug("Arguments:", JSON.stringify(request.params.arguments, null, 2));

    try {
      if (!request.params.arguments) {
        throw new Error("Arguments are required");
      }

      switch (request.params.name) {
        case "extract_triples": {
          const args = triples.ExtractTriplesSchema.parse(
            request.params.arguments,
          );
          const result = await triples.extractTriples(args.input);
          return {
            _meta: {},
            content: [
              {
                type: "text" as const,
                text: "Extracted triples",
                data: result,
              },
            ],
          };
        }
        case "search_atoms": {
          const args = atomSearchOperation.parameters.parse(
            request.params.arguments,
          );
          return await atomSearchOperation.execute(args);
        }
        case "get_account_info": {
          const args = getAccountInfoOperation.parameters.parse(
            request.params.arguments,
          );
          return await getAccountInfoOperation.execute(args);
        }
        case "search_lists": {
          const args = searchListsOperation.parameters.parse(
            request.params.arguments,
          );
          return await searchListsOperation.execute(args);
        }
        case "get_following": {
          const args = getFollowingOperation.parameters.parse(
            request.params.arguments,
          );
          return await getFollowingOperation.execute(args);
        }
        case "get_followers": {
          const args = getFollowersOperation.parameters.parse(
            request.params.arguments,
          );
          return await getFollowersOperation.execute(args);
        }
        case "search_account_ids": {
          const args = searchAccountIdsOperation.parameters.parse(
            request.params.arguments,
          );
          return await searchAccountIdsOperation.execute(args);
        }
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    } catch (error) {
      debug("Tool Call Error:", error);
      return {
        _meta: {},
        content: [
          {
            type: "text" as const,
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  },
);

async function runStdioServer() {
  debug("Starting MCP Server with stdio transport");
  const transport = new StdioServerTransport();
  await server.connect(transport);
  debug("Server initialized and connected via stdio");
}

async function runHttpServer() {
  const app = express();
  const port = process.env.PORT || 3001;

  let transport: SSEServerTransport | null = null;

  // Basic request logging
  app.use((req: Request, res: Response, next) => {
    debug(`${req.method} ${req.path}`);
    next();
  });

  // Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      version: SERVER_CONFIG.version,
      name: SERVER_CONFIG.name,
    });
  });

  app.get("/sse", (req: Request, res: Response) => {
    debug("New SSE connection established");
    transport = new SSEServerTransport("/messages", res);
    server.connect(transport);
  });

  app.post("/messages", (req: Request, res: Response) => {
    if (transport) {
      transport.handlePostMessage(req, res);
    } else {
      res.status(400).json({ error: "No active SSE connection" });
    }
  });

  app.listen(port, () => {
    debug(`HTTP server listening on port ${port}`);
  });
}

// Determine server mode from environment variable
const serverMode = process.env.SERVER_MODE || "stdio";

if (serverMode === "http") {
  runHttpServer().catch((error) => {
    console.error("Fatal HTTP server error:", error);
    process.exit(1);
  });
} else {
  runStdioServer().catch((error) => {
    console.error("Fatal stdio server error:", error);
    process.exit(1);
  });
}
