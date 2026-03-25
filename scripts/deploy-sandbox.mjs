import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// near-api-js v7 exports
const nearApi = await import('near-api-js');

const keyStore = new nearApi.keyStores.UnencryptedFileSystemKeyStore(
  join(homedir(), '.near-credentials', 'local')
);

const near = await nearApi.connect({
  networkId: 'local',
  keyStore,
  nodeUrl: 'http://localhost:3031',
});

const account = await near.account('test.near');
const balance = await account.getAccountBalance();
console.log('Balance:', balance.available);

const wasm = readFileSync('/tmp/test-contract/target/wasm32-unknown-unknown/release/test_contract.wasm');
console.log('Deploying', wasm.length, 'bytes...');

const deployResult = await account.deployContract(wasm);
console.log('Deploy status:', JSON.stringify(deployResult.status));

const callResult = await account.functionCall({
  contractId: 'test.near',
  methodName: 'new',
  args: {},
  gas: '30000000000000',
  attachedDeposit: '0',
});
console.log('Call status:', JSON.stringify(callResult.status));
