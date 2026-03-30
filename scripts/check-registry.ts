/**
 * Check agent registry contract
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createPublicClient, http } from "viem";

const AGENT_ADDRESS = process.env.FILECOIN_AGENT_ADDRESS;
const REGISTRY_ADDRESS = process.env.FILECOIN_AGENT_REGISTRY_ADDRESS;
const RPC_URL = process.env.FILECOIN_RPC_URL ?? "https://api.calibration.node.glif.io/rpc/v1";

if (!AGENT_ADDRESS || !REGISTRY_ADDRESS) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

const filecoinCalibration = {
  id: 314159,
  name: "Filecoin Calibration Testnet",
  nativeCurrency: { name: "testnet FIL", symbol: "tFIL", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
} as const;

async function checkRegistry() {
  console.log("🔍 Checking Agent Registry...\n");
  console.log(`Registry Address: ${REGISTRY_ADDRESS}`);
  console.log(`Agent Address: ${AGENT_ADDRESS}\n`);

  const client = createPublicClient({
    chain: filecoinCalibration,
    transport: http(RPC_URL),
  });

  try {
    // Check if registry has code
    const code = await client.getBytecode({
      address: REGISTRY_ADDRESS as `0x${string}`,
    });

    if (!code || code === "0x") {
      console.error("❌ No contract code at registry address!");
      process.exit(1);
    }

    console.log(`✓ Registry has code (${code.length} bytes)\n`);

    // Try to get agent reputation
    try {
      const reputation = await client.readContract({
        address: REGISTRY_ADDRESS as `0x${string}`,
        abi: [{
          type: "function",
          name: "getAgentReputation",
          inputs: [{ type: "address" }],
          outputs: [{ 
            type: "tuple", 
            components: [
              { name: "score", type: "uint256" },
              { name: "tasksCompleted", type: "uint256" },
              { name: "tasksFailed", type: "uint256" },
              { name: "lastUpdated", type: "uint256" }
            ] 
          }]
        }],
        functionName: "getAgentReputation",
        args: [AGENT_ADDRESS as `0x${string}`],
      });
      
      console.log("✓ Agent is registered");
      const rep = reputation as { score: bigint; tasksCompleted: bigint; tasksFailed: bigint; lastUpdated: bigint };
      console.log(`  Score: ${rep.score}`);
      console.log(`  Tasks Completed: ${rep.tasksCompleted}`);
      console.log(`  Tasks Failed: ${rep.tasksFailed}`);
    } catch (e: any) {
      console.error("❌ Failed to get agent reputation:");
      console.error(`   ${e.message?.slice(0, 200)}`);
      console.log("\n⚠️  Agent may need to be registered first");
    }

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

checkRegistry();
