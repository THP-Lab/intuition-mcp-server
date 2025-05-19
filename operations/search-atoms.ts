import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { client } from "../graphql/client.js";
import { SearchAtomsQuery } from "../graphql/generated/graphql.js";
import { gql } from "graphql-request";
import { removeEmptyFields } from "../lib/response.js";

// Define the parameters schema
const parameters = z.object({
  queries: z.array(z.string().min(1)).min(1),
});

// Define the operation interface
interface AtomSearchOperation {
  description: string;
  parameters: typeof parameters;
  execute: (args: z.infer<typeof parameters>) => Promise<CallToolResult>;
}

export const SEARCH_ATOMS = function (params: string[]) {
  return `
  query SearchAtoms(${params
    .map((param, index) => {
      return `$like${index}Str: String!`;
    })
    .join(", ")}) {
    atoms(
      where: {
        _or: [
        ${params
          .map((param, index) => {
            return `{ value: { account: { label: {  _ilike: $like${index}Str }}}}
          { value: { thing: { url: {  _ilike: $like${index}Str }}}}
          { value: { thing: { name: {  _ilike: $like${index}Str }}}}
          { value: { thing: { description: {  _ilike: $like${index}Str }}}}
          { value: { person: { url: { _ilike: $like${index}Str } } } }
          { value: { person: { name: { _ilike: $like${index}Str } } } }
          { value: { person: { description: { _ilike: $like${index}Str } } } }
          { value: { organization: { url: { _ilike: $like${index}Str } } } }
          { value: { organization: { name: { _ilike: $like${index}Str } } } }
          { value: { organization: { description: { _ilike: $like${index}Str } } } }`;
          })
          .join("\n")}
        ]
      }
      order_by: { vault: { position_count: desc } }
    ) {
      id
      label
      value {
        account {
          id
          label
        }
        person {
          name
          description
          email
          identifier
        }
        thing {
          url
          name
          description
        }
        organization {
          name
          email
          description
          url
        }
      }
      vault {
        position_count
        current_share_price
        total_shares
      }
      as_subject_triples {
        id
        object {
          id
          label
          emoji
          image
        }
        predicate {
          emoji
          label
          image
          id
        }
        counter_vault {
          position_count
          current_share_price
          total_shares
        }
        vault {
          position_count
          current_share_price
          total_shares
        }
      }
    }
  }
`;
};

export const atomSearchOperation: AtomSearchOperation = {
  description: `Search for accounts, things, people, and concepts by name, description, URL or ens domain (e.g. john.eth).

Use the user input with synonyms or break it down into single words for arguments.

### Examples
Examples of cases when to use the tool to assist the user and the arguments to extract:

- user_message: search atoms for ethereum
  tool_args: {"queries":["ethereum","eth"]}

- user_message: search for data about intuition
  tool_args: {"queries":["intuition"]}

- user_message: what information you have about centralized exchanges
  tool_args: {"queries":["centralized exchanges","cex"]}

- user_message: what's in intuition about ethereum
  tool_args: {"queries":["ethereum","eth"]}

- user_message: find atoms for vitalik buterin
  tool_args: {"queries":["vitalik buterin","vitalik.eth","vitalik"]}

- user_message: tell me what you know about blockchains
  tool_args: {"queries":["blockchain"]}

- user_message: what connection does he have to vitalik
  tool_args: {"queries":["vitalik","vitalik.eth","vitalik buterin"]}

- user_message: do you know something about billy.eth
  tool_args: {"queries":["billy.eth","bill","william"]}

### Response format

When replying to the user using the tool call result, favor the most popular atoms(with the largest positions) and sort them by position descending.
Always mention the atom ids. Give at least 10 connections and a good amount of details. Structure your reply but keep a natural and engaging format and follow the other speech directives.
`,
  parameters,
  async execute(args) {
    console.log("\n=== Starting Atom Search Operation ===");
    console.log("Search string:", args.queries);

    try {
      console.log("\n=== Calling GraphQL Search ===");

      const queryArgs = args.queries.slice(0, 5);
      const query = SEARCH_ATOMS(queryArgs);
      console.log(query);

      const vars: { [type: string]: string } = {};
      for (let i = 0; i < args.queries.length; i++) {
        vars[`like${i}Str`] = `%${args.queries[i]}`;
      }
      const { atoms } = (await client.request(query, vars)) as SearchAtomsQuery;
      // const sdk = getSdk(client);

      // const { atoms } = await sdk.SearchAtoms({
      //   likeStr: `%${args.queries}%`,
      // });

      console.log("\n=== Raw Search Results ===");
      console.log("Results type:", typeof atoms);
      console.log("Is array:", Array.isArray(atoms));
      console.log("Number of results:", atoms?.length || 0);

      if (atoms?.length > 0) {
        console.log("\n=== Result Details ===");
        atoms.forEach((atom, i) => {
          console.log(`\nAtom ${i + 1}:`);
          console.log("- Label:", atom.label);
          console.log("- ID:", atom.id);
          if (atom.value?.account) {
            console.log("- Account:", atom.value.account.label);
          }
          if (atom.vault) {
            console.log("- Position count:", atom.vault.position_count);
          }
        });
      }

      // Ensure results is an array and format for display
      const validResults = (atoms || []).map((atom) => {
        const type = atom.value?.account
          ? "account"
          : atom.value?.person
            ? "person"
            : atom.value?.thing
              ? "thing"
              : atom.value?.organization
                ? "organization"
                : "unknown";

        const details = {
          id: atom.id,
          label: atom.label,
          type,
          value: atom.value,
          vault: atom.vault,
          triples: atom.as_subject_triples,
        };

        return {
          type: "text" as const,
          text: `${atom.label || "Unnamed"} (${type})`,
          data: details,
        };
      });

      // Return in MCP format
      const response: CallToolResult = {
        content: [
          {
            type: "resource",
            resource: {
              uri: "atom-search-result",
              text: JSON.stringify(removeEmptyFields(atoms) || []),
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
