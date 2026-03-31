/**
 * Register both agents in AgentRegistry.sol (ERC-8004)
 *
 * Run: npx tsx scripts/register-agents.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const REGISTRY_ADDRESS  = process.env.FILECOIN_AGENT_REGISTRY_ADDRESS as `0x${string}`;
const PLATFORM_KEY      = process.env.EVM_PLATFORM_PRIVATE_KEY as `0x${string}`;
const CORR_AGENT        = process.env.FILECOIN_AGENT_ADDRESS as `0x${string}`;
const TRUST_AGENT       = process.env.FILECOIN_TRUST_AGENT_ADDRESS as `0x${string}`;
const RPC_URL           = process.env.FILECOIN_RPC_URL ?? "https://api.calibration.node.glif.io/rpc/v1";

if (!REGISTRY_ADDRESS || !PLATFORM_KEY || !CORR_AGENT || !TRUST_AGENT) {
  console.error("❌ Missing environment variables. Check .env.local");
  process.exit(1);
}

const chain = {
  id: 314159,
  name: "Filecoin Calibration Testnet",
  nativeCurrency: { name: "testnet FIL", symbol: "tFIL", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
} as const;

const REGISTRY_ABI = [
  {
    type: "function",
    name: "registerAgent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentAddress", type: "address" },
      { name: "did",          type: "string"  },
      { name: "name",         type: "string"  },
      { name: "capabilities", type: "string[]"},
      { name: "metadataUri",  type: "string"  },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getAgentReputation",
    stateMutability: "view",
    inputs: [{ type: "address" }],
    outputs: [{
      type: "tuple",
      components: [
        { name: "score",          type: "uint256" },
        { name: "tasksCompleted", type: "uint256" },
        { name: "tasksFailed",    type: "uint256" },
        { name: "lastUpdated",    type: "uint256" },
      ],
    }],
  },
] as const;

async function register(
  wallet: ReturnType<typeof createWalletClient>,
  agentAddress: `0x${string}`,
  did: string,
  name: string,
  capabilities: string[],
  metadataUri: string,
) {
  console.log(`\nRegistering: ${name}`);
  console.log(`  Address:      ${agentAddress}`);
  console.log(`  DID:          ${did}`);
  console.log(`  Capabilities: ${capabilities.join(", ")}`);

  const hash = await wallet.writeContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: "registerAgent",
    args: [agentAddress, did, name, capabilities, metadataUri],
  });

  console.log(`  tx: ${hash}`);
  console.log(`  Explorer: https://calibration.filfox.info/en/tx/${hash}`);
  return hash;
}

async function main() {
  console.log("=== Radrr Agent Registration ===\n");
  console.log(`Registry: ${REGISTRY_ADDRESS}`);
  console.log(`Platform wallet signing transactions`);

  const account = privateKeyToAccount(PLATFORM_KEY);
  const wallet = createWalletClient({ account, chain, transport: http(RPC_URL) });
  const client = createPublicClient({ chain, transport: http(RPC_URL) });

  // Check registry has code
  const code = await client.getBytecode({ address: REGISTRY_ADDRESS });
  if (!code || code === "0x") {
    console.error("❌ No contract at registry address");
    process.exit(1);
  }
  console.log(`✓ Registry contract found\n`);

  // Register corroboration agent
  await register(
    wallet,
    CORR_AGENT,
    `did:erc8004:filecoin:${CORR_AGENT.toLowerCase()}`,
    "Radrr Corroboration Agent",
    ["corroboration", "similarity-analysis", "on-chain-attestation", "reputation-update"],
    "https://radrr.vercel.app/agent.json",
  );

  // Small delay between txs
  await new Promise((r) => setTimeout(r, 3000));

  // Register trust agent
  await register(
    wallet,
    TRUST_AGENT,
    `did:erc8004:filecoin:${TRUST_AGENT.toLowerCase()}`,
    "Radrr Trust Agent",
    ["trust-validation", "credential-issuance", "reputation-monitoring"],
    "https://radrr.vercel.app/agent.json",
  );

  console.log("\n✓ Both agents registered. Verify with:");
  console.log("  npx tsx scripts/check-registry.ts");
}

main().catch((err) => {
  console.error("❌ Registration failed:", err.message ?? err);
  process.exit(1);
});
