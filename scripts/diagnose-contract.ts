/**
 * Diagnose contract issues
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createPublicClient, http } from "viem";

const CONTRACT_ADDRESS = process.env.FILECOIN_CONTRACT_ADDRESS;
const RPC_URL = process.env.FILECOIN_RPC_URL ?? "https://api.calibration.node.glif.io/rpc/v1";

if (!CONTRACT_ADDRESS) {
  console.error("❌ FILECOIN_CONTRACT_ADDRESS not set");
  process.exit(1);
}

const filecoinCalibration = {
  id: 314159,
  name: "Filecoin Calibration Testnet",
  nativeCurrency: { name: "testnet FIL", symbol: "tFIL", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
} as const;

async function diagnose() {
  console.log("🔍 Diagnosing Contract...\n");
  console.log(`Contract Address: ${CONTRACT_ADDRESS}`);
  console.log(`RPC: ${RPC_URL}\n`);

  const client = createPublicClient({
    chain: filecoinCalibration,
    transport: http(RPC_URL),
  });

  try {
    // Check if contract has code
    const code = await client.getBytecode({
      address: CONTRACT_ADDRESS as `0x${string}`,
    });

    if (!code || code === "0x") {
      console.error("❌ ERROR: No contract code found at this address!");
      console.error("   The contract is not deployed or the address is wrong.");
      process.exit(1);
    }

    console.log(`✓ Contract has code (${code.length} bytes)\n`);

    // Try to call totalRecordings (simple view function)
    console.log("Testing contract functions...");
    
    try {
      const total = await client.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: [{ 
          type: "function", 
          name: "totalRecordings", 
          inputs: [], 
          outputs: [{ type: "uint256" }] 
        }],
        functionName: "totalRecordings",
      });
      console.log(`✓ totalRecordings(): ${total}`);
    } catch (e) {
      console.error(`❌ totalRecordings() failed: ${e}`);
    }

    try {
      const recordings = await client.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: [{
          type: "function",
          name: "getRecordings",
          inputs: [{ type: "uint256" }, { type: "uint256" }],
          outputs: [{ type: "tuple[]", components: [] }]
        }],
        functionName: "getRecordings",
        args: [BigInt(0), BigInt(1)],
      });
      console.log(`✓ getRecordings(0, 1): ${JSON.stringify(recordings).slice(0, 100)}...`);
    } catch (e: any) {
      console.error(`❌ getRecordings() failed:`);
      console.error(`   ${e.message?.slice(0, 200)}`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  }
}

diagnose();
