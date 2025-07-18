import { z } from "zod";
import { gql } from "graphql-request";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { client } from "../graphql/client.js";

// Schéma des paramètres (tu peux filtrer sur les term_ids)
const parameters = z.object({
  ids: z.array(z.number()).min(1).describe("Array of numeric term IDs to get triples for"),
  addressFilter: z.string().optional().describe("Optional substring to filter user accounts by address"),
});

// Typage des données GraphQL
type Account = {
  id: string;
  label: string;
  image: string | null;
};

type Position = {
  account: Account;
  shares: string;
};

type Vault = {
  total_shares: string;
  positions: Position[];
};

type Term = {
  vaults: Vault[];
};

type Triple = {
  term_id: string;
  subject: { label: string; image: string | null };
  predicate: { label: string; image: string | null };
  object: { label: string; image: string | null };
  term: Term;
  counter_term: Term;
};

interface GetTriplesWithPositionsResponse {
  triples: Triple[];
}

// GraphQL Query
const GET_TRIPLES_WITH_POSITIONS = gql`
  query GetTriplesWithPositions($ids: [numeric!]!, $address: String) {
    triples(where: { term_id: { _in: $ids } }) {
      term_id
      subject {
        label
        image
      }
      predicate {
        label
        image
      }
      object {
        label
        image
      }
      term {
        vaults {
          total_shares
          positions(where: { account: { id: { _ilike: $address } } }) {
            account {
              id
              label
              image
            }
            shares
          }
        }
      }
      counter_term {
        vaults {
          total_shares
          positions(where: { account: { id: { _ilike: $address } } }) {
            account {
              id
              label
              image
            }
            shares
          }
        }
      }
    }
  }
`;

// Format de réponse MCP : on extrait l’essentiel
type FormattedPosition = {
  accountId: string;
  label: string;
  shares: string;
};

type FormattedVault = {
  totalShares: string;
  positions: FormattedPosition[];
};

type FormattedTerm = {
  vaults: FormattedVault[];
};

type FormattedTriple = {
  termId: string;
  subject: string;
  predicate: string;
  object: string;
  termVaults: FormattedVault[];
  counterTermVaults: FormattedVault[];
};

function formatTriples(data: GetTriplesWithPositionsResponse): FormattedTriple[] {
  return data.triples.map(triple => ({
    termId: triple.term_id,
    subject: triple.subject.label,
    predicate: triple.predicate.label,
    object: triple.object.label,
    termVaults: triple.term.vaults.map(vault => ({
      totalShares: vault.total_shares,
      positions: vault.positions.map(pos => ({
        accountId: pos.account.id,
        label: pos.account.label,
        shares: pos.shares,
      })),
    })),
    counterTermVaults: triple.counter_term.vaults.map(vault => ({
      totalShares: vault.total_shares,
      positions: vault.positions.map(pos => ({
        accountId: pos.account.id,
        label: pos.account.label,
        shares: pos.shares,
      })),
    })),
  }));
}

// Export de l’opération MCP
export const getTriplesWithPositionsOperation = {
  description: "Get triples by IDs including user positions filtered optionally by address substring.",
  parameters,
  async execute(args: z.infer<typeof parameters>): Promise<CallToolResult> {
    try {
      // Prépare filtre adresse insensible à la casse ou null
      const addressFilter = args.addressFilter ? `%${args.addressFilter}%` : "%";

      const data = await client.request<GetTriplesWithPositionsResponse>(
        GET_TRIPLES_WITH_POSITIONS,
        { ids: args.ids, address: addressFilter }
      );

      const response: CallToolResult = {
        content: [
          {
            type: "resource",
            resource: {
              uri: "get-triples-with-positions-result",
              text: JSON.stringify(formatTriples(data), null, 2),
              mimeType: "application/json",
            },
          },
        ],
      };

      return response;
    } catch (error) {
      console.error("Error in getTriplesWithPositions:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
};
