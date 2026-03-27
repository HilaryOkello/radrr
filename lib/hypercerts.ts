/**
 * Hypercerts v2 integration.
 * Mints an impact certificate on every confirmed footage sale.
 * Deploys on Sepolia testnet (EVM).
 */

import {
  HypercertClient,
  TransferRestrictions,
  formatHypercertData,
  getClaimStoredDataFromTxHash,
} from "@hypercerts-org/sdk";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

function getClients() {
  const privateKey = process.env.EVM_PLATFORM_PRIVATE_KEY as `0x${string}`;
  if (!privateKey) throw new Error("EVM_PLATFORM_PRIVATE_KEY not set");

  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(
      process.env.SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org"
    ),
  });
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(
      process.env.SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org"
    ),
  });
  return { walletClient, publicClient };
}

export interface HypercertParams {
  recordingId: string;
  witnessAddress: string;
  witnessCredibilityScore: number;
  eventDescription: string;
  gpsApprox: string;
  recordingTimestamp: number;
  isCorroborated: boolean;
  isPublicShare?: boolean;
}

/**
 * Mint a Hypercert for a confirmed footage sale.
 */
export async function mintSaleHypercert(params: HypercertParams): Promise<string> {
  const { walletClient, publicClient } = getClients();

  const client = new HypercertClient({
    environment: "test",
    walletClient,
    publicClient,
  });

  const isPublicShare = params.isPublicShare ?? false;

  const verificationLevel = isPublicShare
    ? "public"
    : params.isCorroborated
    ? "corroborated"
    : params.witnessCredibilityScore > 50
    ? "verified"
    : "unverified";

  const workTimeframeStart = Math.floor(params.recordingTimestamp / 1000);
  const workTimeframeEnd = workTimeframeStart + 3600;

  const { data, errors } = formatHypercertData({
    name: isPublicShare
      ? `Radrr Public Documentation — ${params.eventDescription.slice(0, 60)}`
      : `Radrr Witness Documentation — ${params.eventDescription.slice(0, 60)}`,
    description: [
      isPublicShare
        ? `Freely shared citizen journalism footage on Radrr — no purchase required.`
        : `Citizen journalism footage documented by a verified Radrr witness.`,
      `Event: ${params.eventDescription}`,
      `Location: ${params.gpsApprox} (approximate)`,
      `Recording ID: ${params.recordingId}`,
      `Verification level: ${verificationLevel}`,
      `Witness credibility score: ${params.witnessCredibilityScore}`,
    ].join("\n"),
    image: "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    version: "2.0",
    // camelCase for v2 SDK
    workScope: ["citizen-journalism", "event-documentation", "radrr"],
    workTimeframeStart,
    workTimeframeEnd,
    impactScope: ["media-integrity", "journalist-safety"],
    impactTimeframeStart: workTimeframeStart,
    impactTimeframeEnd: workTimeframeEnd + 31536000,
    contributors: [params.witnessAddress],
    rights: ["Public Display"],
    excludedRights: [],
    excludedImpactScope: [],
    excludedWorkScope: [],
    properties: [
      { trait_type: "recording_id", value: params.recordingId },
      { trait_type: "verification_level", value: verificationLevel },
      { trait_type: "gps_approx", value: params.gpsApprox },
      { trait_type: "is_corroborated", value: String(params.isCorroborated) },
      { trait_type: "is_public_share", value: String(isPublicShare) },
      { trait_type: "platform", value: "radrr" },
    ],
  });

  if (errors || !data) {
    throw new Error(`Hypercert data error: ${JSON.stringify(errors)}`);
  }

  const txHash = await client.mintHypercert({
    metaData: data,
    totalUnits: BigInt(10000),
    transferRestriction: TransferRestrictions.FromCreatorOnly,
  });

  if (!txHash) throw new Error("No tx hash returned from mintHypercert");

  const claimData = await getClaimStoredDataFromTxHash(publicClient, txHash);
  if (!claimData.success || !claimData.data) {
    throw new Error(`Could not extract claim ID from tx ${txHash}`);
  }

  return String(claimData.data.claimId);
}
