/**
 * Generate a new agent wallet
 * Run this if your agent credentials are invalid or missing
 */

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

console.log("🔑 Generating new agent wallet...\n");

// Generate new key pair
const privateKey = generatePrivateKey();
const account = privateKeyToAccount(privateKey);

console.log("✓ New wallet generated!\n");
console.log("Add these to your .env.local file:\n");
console.log(`FILECOIN_AGENT_ADDRESS=${account.address}`);
console.log(`FILECOIN_AGENT_PRIVATE_KEY=${privateKey}`);
console.log("\n⚠️  IMPORTANT:");
console.log("   1. Save these credentials securely");
console.log("   2. Get testnet FIL from https://faucet.calibration.filecoin.io/");
console.log("   3. The agent needs gas funds to operate");
