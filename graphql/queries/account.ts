import { gql } from 'graphql-request';

export const GET_ACCOUNT_INFO = gql`
  query GetAccountInfo($address: String!) {
    account(id: $address) {
      image
      label
      id
      atoms {
        id
        label
        data
        value {
          thing {
            description
          }
        }
        vault {
          total_shares
          positions_aggregate(where: { account_id: { _eq: $address } }) {
            nodes {
              account {
                id
              }
              shares
            }
          }
        }
      }
      triples {
        id
        subject {
          id
          label
          value {
            thing {
              id
              image
              description
            }
            account {
              id
              label
              image
            }
            person {
              id
              image
              description
            }
            organization {
              id
              image
              description
            }
          }
        }
        predicate {
          id
          label
          value {
            thing {
              id
              image
              description
            }
            account {
              id
              label
              image
            }
            person {
              id
              image
              description
            }
            organization {
              id
              image
              description
            }
          }
        }
        object {
          id
          label
          value {
            thing {
              id
              image
              description
            }
            account {
              id
              label
              image
            }
            person {
              id
              image
              description
            }
            organization {
              id
              image
              description
            }
          }
        }
      }
      claims {
        triple {
          id
          subject {
            id
            label
            value {
              thing {
                id
                image
                description
              }
              account {
                id
                label
                image
              }
              person {
                id
                image
                description
              }
              organization {
                id
                image
                description
              }
            }
          }
          predicate {
            id
            label
            value {
              thing {
                id
                image
                description
              }
              account {
                id
                label
                image
              }
              person {
                id
                image
                description
              }
              organization {
                id
                image
                description
              }
            }
          }
          object {
            id
            label
            value {
              thing {
                id
                image
                description
              }
              account {
                id
                label
                image
              }
              person {
                id
                image
                description
              }
              organization {
                id
                image
                description
              }
            }
          }
        }
        shares
        counter_shares
      }
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
            value {
              thing {
                id
                image
                description
              }
              account {
                id
                label
                image
              }
              person {
                id
                image
                description
              }
              organization {
                id
                image
                description
              }
            }
          }
        }
      }
    }
  }
`;
