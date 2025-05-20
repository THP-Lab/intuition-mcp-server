import { gql } from 'graphql-request';

export const SEARCH_ATOMS = gql`
  query SearchAtoms($likeStr: String!) {
    atoms(
      where: { label: { _ilike: $likeStr } }
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

export const SEARCH_LISTS = gql`
  query SearchLists($str: String!) {
    predicate_objects(
      where: { object: { label: { _ilike: $str } } }
      limit: 20
      order_by: { claim_count: desc }
    ) {
      id
      claim_count
      triple_count
      object {
        label
        id
      }
    }
  }
`;
