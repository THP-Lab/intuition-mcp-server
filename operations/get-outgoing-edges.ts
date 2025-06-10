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
      "The account id of the account to find the outgoing edges for. Example: 0x3e2178cf851a0e5cbf84c0ff53f820ad7ead703b",
    ),
  edges_predicate: z
    .string()
    .min(1)
    .describe(
      "The predicate to filter on for outgoing edges. Example: follow, like, dislike, recommend, trust",
    ),
  edges_edges_predicate: z
    .string()
    .min(1)
    .describe(
      `Optional predicate to filter edges' edges on.
Example: recommend, follow, like, dislike, trust`,
    )
    .optional(),
});

// Define the operation interface
interface GetOutgoingEdgesOperation {
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
  id?: string;
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
  account?: Account;
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
interface GetOutgoingEdgesQueryResponse {
  claims: Claim[];
}

const getOutgoingEdgesEdgesQuery = gql`
  query outgoingEdges(
    $where: claims_bool_exp
    $orderBy: [claims_order_by!]
    $limit: Int
    $whereAccountsClaims: claims_bool_exp
    $whereAccounts: accounts_bool_exp
  ) {
    claims(where: $where, order_by: $orderBy, limit: $limit) {
      account {
        id
        label
      }
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
              id
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
                book {
                  name
                  description
                  url
                }
              }
            }
            predicate {
              label
            }
            object {
              id
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
                book {
                  name
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


const getOutgoingEdgesQuery = gql`
  query outgoingEdges(
    $where: claims_bool_exp
    $orderBy: [claims_order_by!]
    $limit: Int
  ) {
    claims(where: $where, order_by: $orderBy, limit: $limit) {
      account {
        id
        label
      }
      subject {
        label
      }
      predicate {
        label
      }
      object {
        id
        label
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
          book {
            name
            description
            url
          }
        }
      }
    }
  }
`;

type PredicatesResponse = {
  label: string;
  id: string | undefined;
  type: string;
};

interface FormattedOutgoingEdgesPredicateQueryResponse {
  id: string;
  label: string;
  type: string;
  outgoingEdges: {
    id: string;
    label: string;
    predicates: PredicatesResponse[];
  }[];
}

function formatResponse(
  result: GetOutgoingEdgesQueryResponse,
): FormattedOutgoingEdgesPredicateQueryResponse {
  const formattedResult: FormattedOutgoingEdgesPredicateQueryResponse = {
    id: "",
    label: "",
    type: "",
    outgoingEdges: [],
  };
  for (const claim of result.claims) {
    if (typeof claim.account !== "undefined") {
      formattedResult.id = claim.account.id;
      formattedResult.label = claim.account.label;
      formattedResult.type = claim.predicate.label;
    }
    for (const account of claim.object.accounts || []) {
      const outgoingEdges = {
        id: account.id,
        label: account.label,
        type: claim.predicate.label,
        predicates: [] as PredicatesResponse[],
      } as {
        id: string;
        label: string;
        predicates: PredicatesResponse[];
      };
      for (const objectClaim of account.claims) {
        const value = objectClaim.object.value;
        const pred = {
          label:
            value && value.account
              ? value.account.label
              : objectClaim.object.label,
          id: value && value.account ? value.account.id : objectClaim.object.id,
          type: objectClaim.predicate.label,
        };
        outgoingEdges.predicates.push(pred);
      }
      formattedResult.outgoingEdges.push(outgoingEdges);
    }
  }

  return formattedResult;
}

export const getOutgoingEdgesOperation: GetOutgoingEdgesOperation = {
  description: `Get outgoing edges filtered on the type of relation for a given account.
Also retrieves the outgoing edges edges optionally filtered on a type of relation.

## Example:

- user: what do the accounts I follow follow?
  tool_args: {"identifier":"0x3e2178cf851a0e5cbf84c0ff53f820ad7ead703b","edges_predicate":"follow","edges_edges_predicate":"follow"}

- user: what do the accounts I follow recommend?
  tool_args: {"identifier":"0x3e2178cf851a0e5cbf84c0ff53f820ad7ead703b","edges_predicate":"follow","edges_edges_predicate":"recommend"}

- user: what are the things I prefer?
  tool_args: {"identifier":"0x3e2178cf851a0e5cbf84c0ff53f820ad7ead703b","edges_predicate":"prefers"}

- user: what are my triples with a predicate 'prefer'?
  tool_args: {"identifier":"0x3e2178cf851a0e5cbf84c0ff53f820ad7ead703b","edges_predicate":"prefers"}
`,
  parameters,
  async execute(args) {
    try {
      console.log("\n=== Calling GraphQL Search ===");

      const address = args.account_id;
      const edgesPredicate = args.edges_predicate;
      const edgesedgesPredicate = args.edges_edges_predicate;

      let result: GetOutgoingEdgesQueryResponse | null = null;
      if (edgesedgesPredicate && edgesedgesPredicate !== "") {
        result = (await client.request(getOutgoingEdgesEdgesQuery, {
          where: {
            predicate: {
              label: {
                _ilike: `%${edgesPredicate}%`,
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
                label: { _ilike: `%${edgesedgesPredicate}%` },
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
        })) as GetOutgoingEdgesQueryResponse;
      } else {
        result = (await client.request(getOutgoingEdgesQuery, {
          where: {
            predicate: {
              label: {
                _ilike: `%${edgesPredicate}%`,
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
        })) as GetOutgoingEdgesQueryResponse;
      }

      // Return in MCP format
      const response: CallToolResult = {
        content: [
          {
            type: "resource",
            resource: {
              uri: "get-outgoing-edges-result",
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
