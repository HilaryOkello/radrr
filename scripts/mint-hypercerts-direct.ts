/**
 * Direct Hypercert minting using viem (bypassing SDK issues)
 * Run: npx tsx scripts/mint-hypercerts-direct.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

// HypercertMinter contract ABI (simplified)
const HYPERCERT_MINTER_ABI = parseAbi([
  "function mintClaim(address account, uint256 units, bytes32 claimHash, uint256 restrictions) external returns (uint256)",
  "function uri(uint256 tokenId) external view returns (string)",
]);

// HypercertMinter contract on Sepolia
const HYPERCERT_MINTER_ADDRESS = "0xa16DFb32Eb140a6f3F2AC68f41dAd8c7e83C4941";

// Recordings that failed to mint hypercerts
const failedRecordings = [
  {
    recordingId: "rec_1774936214215_esh3m9",
    title: "Public Video 1",
    gpsApprox: "-1.3,36.8",
    timestamp: 1774936350,
    witness: "0xb81Ad6d45a468D69212131DE3Dc9cfdaD86367fE",
    isCorroborated: false,
  },
  {
    recordingId: "rec_1774936444348_9horcm",
    title: "Public Video 2",
    gpsApprox: "-1.3,36.8",
    timestamp: 1774936560,
    witness: "0xb81Ad6d45a468D69212131DE3Dc9cfdaD86367fE",
    isCorroborated: false,
  },
  {
    recordingId: "rec_1774936656214_o2j1ro",
    title: "Public Video 3",
    gpsApprox: "-1.3,36.8",
    timestamp: 1774936770,
    witness: "0xb81Ad6d45a468D69212131DE3Dc9cfdaD86367fE",
    isCorroborated: false,
  },
];

async function main() {
  const privateKey = process.env.HYPERCERTS_PRIVATE_KEY as `0x${string}`;
  if (!privateKey) {
    console.error("❌ HYPERCERTS_PRIVATE_KEY not set");
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey);
  console.log("Using account:", account.address);

  const transport = http("https://ethereum-sepolia-rpc.publicnode.com");
  
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport,
  });

  const publicClient = createPublicClient({
    chain: sepolia,
    transport,
  });

  console.log("Minting Hypercerts for failed public recordings...\n");

  for (const rec of failedRecordings) {
    try {
      console.log(`Minting hypercert for: ${rec.title} (${rec.recordingId})`);

      // Create metadata
      const metadata = {
        name: `Radrr: ${rec.title.slice(0, 60)}`,
        description: [
          "Freely shared citizen journalism footage on Radrr.",
          `Location: ${rec.gpsApprox}`,
          `Recording ID: ${rec.recordingId}`,
          `Corroborated: ${rec.isCorroborated}`,
        ].join("\n"),
        external_url: `https://radrr.vercel.app/recording/${rec.recordingId}`,
        image: "",
      };

      // Upload metadata to IPFS (we'll use a simple data URI for now)
      const metadataJson = JSON.stringify(metadata);
      const metadataBase64 = Buffer.from(metadataJson).toString('base64');
      const metadataUri = `data:application/json;base64,${metadataBase64}`;

      // Mint the hypercert
      const txHash = await walletClient.writeContract({
        address: HYPERCERT_MINTER_ADDRESS,
        abi: HYPERCERT_MINTER_ABI,
        functionName: "mintClaim",
        args: [
          account.address, // mint to the minter address (they can transfer later)
          BigInt(1), // units
          `0x${Buffer.from(metadataUri.slice(0, 64)).toString('hex').padEnd(64, '0')}`, // claimHash (truncated for simplicity)
          BigInt(0), // restrictions (AllowAll)
        ],
      });

      console.log(`⏳ Transaction sent: ${txHash}`);
      
      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      
      if (receipt.status === 'success') {
        console.log(`✅ Success! Gas used: ${receipt.gasUsed}`);
        console.log(`   View on Sepolia: https://sepolia.etherscan.io/tx/${txHash}\n`);
      } else {
        console.log(`❌ Transaction failed\n`);
      }
    } catch (err) {
      console.error(`❌ Failed to mint for ${rec.recordingId}:`, err);
      console.log();
    }
  }

  console.log("Done!");
}

main().catch(console.error);
