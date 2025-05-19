import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { client } from "../graphql/client.js";
import { SearchAtomsQuery } from "../graphql/generated/graphql.js";
import { gql } from "graphql-request";
import { removeEmptyFields } from "../lib/response.js";

// Define the parameters schema
const parameters = z.object({
  identifier: z
    .string()
    .min(1)
    .describe(
      "The account identifier to search the id for, typically an ens address. Example: intuitionbilly.eth",
    ),
});

// Define the operation interface
interface SearchAccountIdsOperation {
  description: string;
  parameters: typeof parameters;
  execute: (args: z.infer<typeof parameters>) => Promise<CallToolResult>;
}

const searchAccountIdsQuery = gql`
  query Accounts($where: accounts_bool_exp) {
    accounts(where: $where) {
      id
    }
  }
`;

export const searchAccountIdsOperation: SearchAccountIdsOperation = {
  description: `Search account address for a given identifier.

## Example:

- user: what are intuitionbilly users he follows liking?
  tool_args: {"identifier":"intuitionbilly"}

- user: what is the address of vitalik.eth account?
  tool_args: {"identifier":"vitalik.eth"}
`,
  parameters,
  async execute(args) {
    try {
      console.log("\n=== Calling GraphQL Search ===");

      const identifier = args.identifier;

      const result = (await client.request(searchAccountIdsQuery, {
        where: {
          label: {
            _ilike: `%${identifier}%`,
          },
        },
      })) as { accounts: { id: string }[] };

      // Return in MCP format
      const response: CallToolResult = {
        content: [
          {
            type: "resource",
            resource: {
              uri: "search-account-ids-result",
              text: JSON.stringify(result),
              mimeType: "application/json",
            },
          },
        ],
      };

      console.log("\n=== Response Format ===");
      console.log(JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      console.error("Error in atom search operation:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      };
    }
  },
};
