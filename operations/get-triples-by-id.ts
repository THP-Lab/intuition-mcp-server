import { z } from "zod";
import { gql } from "graphql-request";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { client } from "../graphql/client.js";

// Schema des paramètres attendus
const parameters = z.object({
  ids: z.array(z.number()).min(1).describe("Array of numeric term IDs to get triples for"),
});

// Typage des données de réponse
type Triple = {
  counter_term_id: number;
  subject: { label: string };
  predicate: { label: string };
  object: { label: string };
};

interface GetTriplesByIdsResponse {
  triples: Triple[];
}

// Format de réponse MCP
interface FormattedTriple {
  subject: string;
  predicate: string;
  object: string;
}

// GraphQL Query
const GET_TRIPLES_BY_IDS = gql`
  query GetTriplesByIds($ids: [numeric!]!) {
    triples(where: { term_id: { _in: $ids } }) {
      counter_term_id
      subject {
        label
      }
      predicate {
        label
      }
      object {
        label
      }
    }
  }
`;

// Fonction de formatage pour le MCP
function formatTriples(data: GetTriplesByIdsResponse): FormattedTriple[] {
  return data.triples.map(triple => ({
    subject: triple.subject.label,
    predicate: triple.predicate.label,
    object: triple.object.label,
  }));
}

// Opération exportable
export const getTriplesByIdsOperation = {
  description: "Get triples based on an array of term IDs.",
  parameters,
  async execute(args: z.infer<typeof parameters>): Promise<CallToolResult> {
    try {
      const data = await client.request<GetTriplesByIdsResponse>(GET_TRIPLES_BY_IDS, { ids: args.ids });

      const response: CallToolResult = {
        content: [
          {
            type: "resource",
            resource: {
              uri: "get-triples-result",
              text: JSON.stringify(formatTriples(data), null, 2),
              mimeType: "application/json",
            },
          },
        ],
      };

      return response;
    } catch (error) {
      console.error("Error in getTriplesByIds:", error);
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
