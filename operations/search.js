import { z } from 'zod';
import { getAccountInfo } from '../lib/graphql.js';
export const SearchIntuitionSchema = z.object({
    triples: z
        .array(z.array(z.string()))
        .describe('Triples to search in intuition'),
    walletAddress: z
        .string()
        .optional()
        .describe('Wallet address to get user context from'),
});
export async function searchIntuition(triples, walletAddress) {
    // First get user context if wallet address is provided
    let userTriples = [];
    if (walletAddress) {
        try {
            const accountInfo = await getAccountInfo(walletAddress);
            if (accountInfo) {
                // Extract triples from user's upvoted content
                userTriples = accountInfo.upvotes
                    .filter((upvote) => upvote.vault.tripleId) // Only include items with triples
                    .map((upvote) => {
                    const [subject, predicate, object] = upvote.label.split(' ');
                    return [subject, predicate, object];
                });
            }
        }
        catch (error) {
            console.error('Error fetching user context:', error);
        }
    }
    // Return both the searched triples and user context
    return {
        searchResults: triples,
        userContext: {
            knownTriples: userTriples,
            description: userTriples.length > 0
                ? `User has previously upvoted ${userTriples.length} statements including: ${userTriples
                    .slice(0, 3)
                    .map((t) => t.join(' '))
                    .join(', ')}${userTriples.length > 3 ? '...' : ''}`
                : 'User has no previous upvotes',
        },
    };
}
