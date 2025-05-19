import { GraphQLClient } from 'graphql-request';

const graphqlUrl =
  process.env.INTUITION_GRAPHQL_URL ||
  'https://prod.base.intuition-api.com/v1/graphql';

export const client = new GraphQLClient(graphqlUrl, {
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': '@0xintuition/mcp-server',
    Origin: 'https://prod.base.intuition-api.com',
  },
});

export type { GraphQLClient };
