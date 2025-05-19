import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { client } from "../graphql/client.js";
import { SearchAtomsQuery } from "../graphql/generated/graphql.js";
import { gql } from "graphql-request";
import { removeEmptyFields } from "../lib/response.js";

// Define the parameters schema
const parameters = z.object({
  account_id: z
    .string()
    .min(1)
    .describe(
      "The account id of the account to find the outbound relations for. Example: 0x3e2178cf851a0e5cbf84c0ff53f820ad7ead703b",
    ),
  relations_predicate: z
    .string()
    .min(1)
    .describe(
      "The predicate to filter on for outbound relations. Example: follow, like, dislike, recommend, trust",
    ),
  relations_relations_predicate: z
    .string()
    .min(1)
    .describe(
      `Optional predicate to filter relations' relations on.
Example: recommend, follow, like, dislike, trust`,
    )
    .optional(),
});

// Define the operation interface
interface GetOutboundRelationsOperation {
  description: string;
  parameters: typeof parameters;
  execute: (args: z.infer<typeof parameters>) => Promise<CallToolResult>;
}

// Base value types that can be null
interface ThingValue {
  url: string;
  description: string;
  name: string;
}

interface AccountValue {
  id: string;
  label: string;
}

// Value interface that contains possible entity types
interface Value {
  thing: ThingValue | null;
  account: AccountValue | null;
  person: null; // Always null in the example
  organization: null; // Always null in the example
}

// Subject interface
interface Subject {
  label: string;
  type?: string; // Optional since it's only present in nested claims
  value?: Value; // Optional since it's only present in nested claims
}

// Predicate interface
interface Predicate {
  label: string;
}

// Object interface
interface Object {
  id?: string; // Optional since it's only in top-level object
  label: string;
  type?: string; // Optional since it's only in nested claims
  value?: Value; // Optional since it's only in nested claims
  accounts?: Account[]; // Optional since it's only in top-level object
}

// Claim interface
interface Claim {
  id?: string;
  subject: Subject;
  predicate: Predicate;
  object: Object;
}

// Account interface
interface Account {
  claims: Claim[];
  id: string;
  label: string;
}

// Top-level data interface
interface GetOutboundRelationsQueryResponse {
  claims: Claim[];
}

const getOutboundRelationsQuery = gql`
  query following(
    $where: claims_bool_exp
    $orderBy: [claims_order_by!]
    $limit: Int
    $whereAccountsClaims: claims_bool_exp
    $whereAccounts: accounts_bool_exp
  ) {
    claims(where: $where, order_by: $orderBy, limit: $limit) {
      subject {
        label
      }
      predicate {
        label
      }
      object {
        id
        label
        accounts(where: $whereAccounts) {
          id
          label
          claims(where: $whereAccountsClaims) {
            subject {
              label
              type
              value {
                thing {
                  url
                  description
                  name
                }
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
                organization {
                  name
                  email
                  description
                  url
                }
              }
            }
            predicate {
              label
            }
            object {
              label
              type
              value {
                thing {
                  url
                  description
                  name
                }
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
                organization {
                  name
                  email
                  description
                  url
                }
              }
            }
          }
        }
      }
    }
  }
`;

type PredicatesResponse = {
  [type: string]: {
    label: string;
    id: string | undefined;
  };
};

interface FormattedOutboundRelationsPredicateQueryResponse {
  following: {
    id: string;
    label: string;
    predicates: PredicatesResponse[];
  }[];
}

function formatResponse(
  result: GetOutboundRelationsQueryResponse,
): FormattedOutboundRelationsPredicateQueryResponse {
  const formattedResult: FormattedOutboundRelationsPredicateQueryResponse = {
    following: [],
  };
  for (const claim of result.claims) {
    for (const account of claim.object.accounts || []) {
      const following = {
        id: account.id,
        label: account.label,
        predicates: [] as PredicatesResponse[],
      } as {
        id: string;
        label: string;
        predicates: PredicatesResponse[];
      };
      for (const objectClaim of account.claims) {
        const pred = {} as PredicatesResponse;
        pred[`${objectClaim.predicate.label}` as string] = {
          label: objectClaim.object.label,
          id: objectClaim.object.id,
        };
        following.predicates.push(pred);
      }
      formattedResult.following.push(following);
    }
  }

  return formattedResult;
}

export const getOutboundRelationsOperation: GetOutboundRelationsOperation = {
  description: `Get outbound relations filtered on the type of relation for a given account.
Also retrieves the outbound relations relations optionally filtered on a type of relation.

## Example:

- user: what do the account I follow follow?
  tool_args: {"identifier":"0x3e2178cf851a0e5cbf84c0ff53f820ad7ead703b","relations_predicate":"follow","relations_relations_predicate":"follow"}

- user: what do the account I follow recommend?
  tool_args: {"identifier":"0x3e2178cf851a0e5cbf84c0ff53f820ad7ead703b","relations_predicate":"follow","relations_relations_predicate":"recommend"}
`,
  parameters,
  async execute(args) {
    try {
      console.log("\n=== Calling GraphQL Search ===");

      const address = args.account_id;
      const relationsPredicate = args.relations_predicate;
      const relationsRelationsPredicate = args.relations_relations_predicate;

      const result = (await client.request(getOutboundRelationsQuery, {
        where: {
          predicate: {
            label: {
              _ilike: `%${relationsPredicate}%`,
            },
          },
          object: {
            type: {
              _eq: "Account",
            },
          },
          account_id: {
            _eq: address,
          },
        },
        whereAccounts: {
          type: {
            _eq: "Default",
          },
        },
        whereAccountsClaims: {
          triple: {
            predicate: {
              label: { _ilike: `%${relationsRelationsPredicate}%` },
            },
          },
        },
        orderBy: [
          {
            vault: {
              position_count: "desc",
            },
          },
          {
            object: {
              vault: {
                position_count: "desc",
              },
            },
          },
        ],
        limit: 100,
      })) as GetOutboundRelationsQueryResponse;

      // Return in MCP format
      const response: CallToolResult = {
        content: [
          {
            type: "resource",
            resource: {
              uri: "get-outbound-relations-result",
              text: JSON.stringify(formatResponse(result)),
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
