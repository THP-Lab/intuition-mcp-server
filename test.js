import { searchIntuition } from './operations/search.js';
import { getAccountInfo } from './lib/graphql.js';
const TEST_WALLET = '0x25709998b542f1be27d19fa0b3a9a67302bc1b94';
async function test() {
    console.log('Testing with wallet:', TEST_WALLET);
    // First test just getting account info
    console.log('\nTesting getAccountInfo...');
    const accountInfo = await getAccountInfo(TEST_WALLET);
    console.log('Account Info:', JSON.stringify(accountInfo, null, 2));
    // Then test search with user context
    console.log('\nTesting searchIntuition...');
    const result = await searchIntuition([['Ethereum', 'is', 'blockchain']], TEST_WALLET);
    console.log('Search results:', JSON.stringify(result, null, 2));
}
test().catch(console.error);
