import { z } from "zod";
import { gql } from "graphql-request";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { client } from "../graphql/client.js";

/* ─── 1. Liste des term_id « en dur » ─── */
const ALL_TERM_IDS = [
  24465, 24466, 24467, 24468, 24469, 24470, 24471, 24472, 24473, 24474,
  24475, 24476, 24477, 24478, 24479, 24480, 24481, 24482, 24483, 24484,
  24485, 24486, 24487, 24488, 24489, 24490, 24491, 24492, 24493, 24494,
  24495, 24496, 24497, 24498, 24499,
  24500, 24501, 24502, 24503, 24504, 24505, 24506, 24507, 24508, 24509,
  24510, 24511, 24512, 24513, 24514, 24515, 24516, 24517, 24518, 24519,
  24520, 24521, 24522,
];

/* ─── 2. Paramètres : uniquement address ─── */
const parameters = z.object({
  /** Sous‑chaîne ou adresse complète ; si vide => toutes les positions */
  address: z.string().optional(),
});

/* ─── 3. Query GraphQL ─── */
const GET_TRIPLES_WITH_POSITIONS = gql`
  query GetTriplesWithPositionsByAddress($ids: [numeric!]!, $address: String) {
    triples(where: { term_id: { _in: $ids } }) {
      term_id
      subject   { label }
      predicate { label }
      object    { label }
      term {
        vaults {
          total_shares
          positions(where: { account: { id: { _ilike: $address } } }) {
            account { id label image }
            shares
          }
        }
      }
      counter_term {
        vaults {
          total_shares
          positions(where: { account: { id: { _ilike: $address } } }) {
            account { id label image }
            shares
          }
        }
      }
    }
  }
`;

/* ─── 4. Types + format identiques à ton outil précédent ─── */
type Account   = { id: string; label: string; image: string | null };
type Position  = { account: Account; shares: string };
type Vault     = { total_shares: string; positions: Position[] };
type Term      = { vaults: Vault[] };
type TripleRaw = {
  term_id: string;
  subject: { label: string };
  predicate: { label: string };
  object: { label: string };
  term: Term;
  counter_term: Term;
};
interface Response { triples: TripleRaw[]; }

const keepTriplesWithPositions = (t: TripleRaw) =>
  t.term.vaults.some(v => v.positions.length) ||
  t.counter_term.vaults.some(v => v.positions.length);

const format = (data: Response) =>
  data.triples
      .filter(keepTriplesWithPositions)
      .map(t => ({
        termId  : t.term_id,
        subject : t.subject.label,
        predicate: t.predicate.label,
        object  : t.object.label,
        termVaults: t.term.vaults.map(v => ({
          totalShares: v.total_shares,
          positions  : v.positions.map(p => ({
            accountId: p.account.id,
            label    : p.account.label,
            shares   : p.shares,
          })),
        })),
        counterTermVaults: t.counter_term.vaults.map(v => ({
          totalShares: v.total_shares,
          positions  : v.positions.map(p => ({
            accountId: p.account.id,
            label    : p.account.label,
            shares   : p.shares,
          })),
        })),
      }));

/* ─── 5. Opération MCP ─── */
export const getTriplesWithPositionsByAddressOperation = {
  description:
    "Return ONLY the triples for which the given address holds a position, using a predefined list of term IDs.",
  parameters,
  async execute(args: z.infer<typeof parameters>): Promise<CallToolResult> {
    try {
      const address = args.address ? `%${args.address}%` : "%";

      const data = await client.request<Response>(
        GET_TRIPLES_WITH_POSITIONS,
        { ids: ALL_TERM_IDS, address }
      );

      return {
        content: [{
          type: "resource",
          resource: {
            uri : "triples-by-address",
            text: JSON.stringify(format(data), null, 2),
            mimeType: "application/json",
          },
        }],
      };
    } catch (err) {
      console.error("Error in getTriplesWithPositionsByAddress:", err);
      return {
        content: [{
          type: "text",
          text: `Error: ${err instanceof Error ? err.message : String(err)}`,
        }],
      };
    }
  },
};
