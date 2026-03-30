/**
 * Check agent wallet balance and configuration
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createPublicClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const AGENT_ADDRESS = process.env.FILECOIN_AGENT_ADDRESS;
const AGENT_PRIVATE_KEY = process.env.FILECOIN_AGENT_PRIVATE_KEY;
const RPC_URL = process.env.FILECOIN_RPC_URL ?? "https://api.calibration.node.glif.io/rpc/v1";

if (!AGENT_ADDRESS || !AGENT_PRIVATE_KEY) {
  console.error("❌ Missing required environment variables");
  console.error("   Please ensure FILECOIN_AGENT_ADDRESS and FILECOIN_AGENT_PRIVATE_KEY are set in .env.local");
  process.exit(1);
}

// Filecoin Calibration Testnet
const filecoinCalibration = {
  id: 314159,
  name: "Filecoin Calibration Testnet",
  nativeCurrency: { name: "testnet FIL", symbol: "tFIL", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
} as const;

async function checkBalance() {
  console.log("🔍 Checking Agent Wallet...\n");
  console.log(`Address: ${AGENT_ADDRESS}`);
  console.log(`Network: ${filecoinCalibration.name} (Chain ID: ${filecoinCalibration.id})`);
  console.log(`RPC: ${RPC_URL}\n`);

  try {
    const client = createPublicClient({
      chain: filecoinCalibration,
      transport: http(RPC_URL),
    });

    // Get balance
    const balance = await client.getBalance({
      address: AGENT_ADDRESS! as `0x${string}`,
    });

    const balanceInEther = formatEther(balance);
    console.log(`💰 Balance: ${balanceInEther} tFIL`);

    if (balance === BigInt(0)) {
      console.log("\n⚠️  WARNING: Wallet has zero balance!");
      console.log("   The agent needs tFIL to pay for gas fees.");
      console.log("   Get testnet FIL from: https://faucet.calibration.filecoin.io/");
    } else if (balance < BigInt("1000000000000000")) { // Less than 0.001 tFIL
      console.log("\n⚠️  WARNING: Low balance!");
      console.log("   Consider adding more tFIL from the faucet.");
    } else {
      console.log("\n✓ Balance looks good!");
    }

    // Verify private key matches address
    try {
      const account = privateKeyToAccount(AGENT_PRIVATE_KEY as `0x${string}`);
      if (account.address.toLowerCase() !== (AGENT_ADDRESS as string).toLowerCase()) {
        console.log("\n❌ ERROR: Private key does not match the agent address!");
        console.log(`   Address from private key: ${account.address}`);
        console.log(`   Expected address: ${AGENT_ADDRESS}`);
        process.exit(1);
      }
      console.log("✓ Private key is valid and matches address");
    } catch (e) {
      console.log("\n❌ ERROR: Invalid private key format");
      process.exit(1);
    }

    // Check network connection
    const blockNumber = await client.getBlockNumber();
    console.log(`✓ Connected to network (block #${blockNumber})`);

  } catch (error) {
    console.error("\n❌ Error checking balance:", error);
    process.exit(1);
  }
}

checkBalance();
