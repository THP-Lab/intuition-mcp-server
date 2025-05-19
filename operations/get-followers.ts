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
      "The account id of the account to find the followers for. Example: 0x3e2178cf851a0e5cbf84c0ff53f820ad7ead703b",
    ),
  predicate: z
    .string()
    .min(1)
    .describe(
      `Optional predicate to filter followers positions on.
Example: recommend, follow, like, dislike`,
    )
    .optional(),
});

// Define the operation interface
interface GetFollowersOperation {
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
  as_subject_claims?: Claim[];
}

// Predicate interface
interface Predicate {
  label: string;
}

// Object interface
interface Object {
  id?: string; // Optional since it's only in top-level object
  label: string;
}

// Claim interface
interface Claim {
  id?: string;
  subject: Subject;
  predicate: Predicate;
  object: Object;
  account: AccountValue;
}

// Top-level data interface
interface GetFollowersQueryResponse {
  claims: Claim[];
}

const getFollowersQuery = gql`
  query followers(
    $where: claims_bool_exp
    $orderBy: [claims_order_by!]
    $limit: Int
    $asSubjectClaimsWhere2: claims_bool_exp
  ) {
    claims(where: $where, order_by: $orderBy, limit: $limit) {
      account {
        id
        label
      }
      subject {
        label
        as_subject_claims(where: $asSubjectClaimsWhere2) {
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
      predicate {
        label
      }
      object {
        id
        label
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

interface FormattedFollowersQueryResponse {
  followers: {
    id: string;
    label: string;
    predicates: PredicatesResponse[];
  }[];
}

function formatResponse(
  result: GetFollowersQueryResponse,
): FormattedFollowersQueryResponse {
  const formattedResult: FormattedFollowersQueryResponse = { followers: [] };
  for (const claim of result.claims) {
    const follower = {
      id: claim.account.id,
      label: claim.account.label,
      predicates: [] as PredicatesResponse[],
    } as {
      id: string;
      label: string;
      predicates: PredicatesResponse[];
    };
    for (const subjectClaim of claim.subject.as_subject_claims || []) {
      const pred = {} as PredicatesResponse;
      pred[`${subjectClaim.predicate.label}` as string] = {
        label: subjectClaim.object.label,
        id: subjectClaim.object.id,
      };
      follower.predicates.push(pred);
    }
    formattedResult.followers.push(follower);
  }

  return formattedResult;
}

export const getFollowersOperation: GetFollowersOperation = {
  description: `Get followers of a given address and potentially their interactions with a predicate.

## Example:

- user: what do my followers follow?
  tool_args: {"identifier":"0x3e2178cf851a0e5cbf84c0ff53f820ad7ead703b","predicate":"follow"}

- user: what do my followers recommend?
  tool_args: {"identifier":"0x3e2178cf851a0e5cbf84c0ff53f820ad7ead703b","predicate":"recommend"}

- user: what are intuitionbilly.eth follower recommend?
  tool_args: {"identifier":"0x3e2178cf851a0e5cbf84c0ff53f820ad7ead703b","predicate":"recommend"}
`,
  parameters,
  async execute(args) {
    try {
      console.log("\n=== Calling GraphQL Search ===");

      const address = args.account_id;

      const result = (await client.request(getFollowersQuery, {
        where: {
          predicate: {
            label: {
              _ilike: "%follow%",
            },
          },
          _or: [
            {
              object: {
                label: {
                  _eq: address,
                },
              },
            },
            {
              object: {
                label: {
                  _eq: address,
                },
              },
            },
          ],
        },
        limit: 100,
        asSubjectClaimsWhere2: {
          predicate: {
            label: {
              _ilike: `%${args.predicate}%`,
            },
          },
        },
      })) as GetFollowersQueryResponse;

      // Return in MCP format
      const response: CallToolResult = {
        content: [
          {
            type: "resource",
            resource: {
              uri: "get-followers-result",
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
