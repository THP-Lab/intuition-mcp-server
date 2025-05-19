import { GraphQLClient } from 'graphql-request';
// Initialize GraphQL client
export const client = new GraphQLClient(process.env.INTUITION_GRAPHQL_URL ||
    'https://api.intuition.systems/v1/graphql');
export const GET_ACCOUNT_INFO = `
  query GetAccountInfo($address: String!) {
    account(id: $address) {
      image
      label
      id
      positions(where: { account_id: { _eq: $address } }) {
        id
        shares
        vault {
          id
          position_count
          total_shares
          current_share_price
          atom {
            id
            label
            image
          }
          triple {
            id
            subject {
              id
              image
              label
            }
            predicate {
              id
              image
              label
            }
            object {
              id
              image
              label
            }
          }
        }
      }
    }
  }
`;
export async function getAccountInfo(address) {
    try {
        const data = await client.request(GET_ACCOUNT_INFO, {
            address: address.toLowerCase(),
        });
        if (!data.account) {
            return null;
        }
        // TODO: Get minDeposit from config
        const minDeposit = BigInt(1); // This should come from config
        const result = {
            account_id: data.account.id,
            label: data.account.label || '',
            upvotes: data.account.positions?.map((position) => ({
                vault: {
                    tripleId: position.vault.triple?.id || '',
                    atomId: position.vault.atom?.id || '',
                },
                label: position.vault.atom?.label ||
                    `${position.vault.triple?.subject.label} ${position.vault.triple?.predicate.label} ${position.vault.triple?.object.label}`,
                upvotes: (BigInt(position.shares) / minDeposit + BigInt(1)).toString(10),
            })) || [],
        };
        return result;
    }
    catch (error) {
        console.error('Error fetching account info:', error);
        return null;
    }
}
