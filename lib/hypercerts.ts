/**
 * Hypercerts integration via @hypercerts-org/sdk.
 * Mints ERC-1155 Hypercerts on Optimism Sepolia (test) or Optimism (production).
 * Returns the transaction hash; token ID can be derived via getHypercertTokenId.
 */

import {
  HypercertClient,
  TransferRestrictions,
  formatHypercertData,
} from "@hypercerts-org/sdk";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { optimismSepolia, optimism } from "viem/chains";

const USE_TESTNET = process.env.HYPERCERTS_TESTNET !== "false";
const CHAIN = USE_TESTNET ? optimismSepolia : optimism;
const ENVIRONMENT = USE_TESTNET ? "test" : "production";

function getClient(): HypercertClient {
  const privateKey = process.env.HYPERCERTS_PRIVATE_KEY as `0x${string}`;
  if (!privateKey) throw new Error("HYPERCERTS_PRIVATE_KEY is not set");

  const account = privateKeyToAccount(privateKey);
  const transport = http(
    USE_TESTNET
      ? (process.env.OPTIMISM_SEPOLIA_RPC_URL ?? "https://sepolia.optimism.io")
      : (process.env.OPTIMISM_RPC_URL ?? "https://mainnet.optimism.io")
  );

  const walletClient = createWalletClient({ account, chain: CHAIN, transport });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new HypercertClient({
    environment: ENVIRONMENT,
    walletClient: walletClient as any,
  });
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
 * Mint a Hypercert for a footage event.
 * Returns the transaction hash of the mint.
 */
export async function mintSaleHypercert(params: HypercertParams): Promise<string> {
  const client = getClient();

  const isPublicShare = params.isPublicShare ?? false;
  const workStart = Math.floor(params.recordingTimestamp / 1000);
  const workEnd = workStart + 3600;

  const { data, valid, errors } = formatHypercertData({
    name: isPublicShare
      ? `Radrr: ${params.eventDescription.slice(0, 60)}`
      : `Radrr Purchase: ${params.eventDescription.slice(0, 60)}`,
    description: [
      isPublicShare
        ? "Freely shared citizen journalism footage on Radrr."
        : "Verified citizen journalism footage purchased on Radrr.",
      `Location: ${params.gpsApprox}`,
      `Recording ID: ${params.recordingId}`,
      `Corroborated: ${params.isCorroborated}`,
    ].join("\n"),
    external_url: `https://radrr.vercel.app/recording/${params.recordingId}`,
    image: "",
    version: "1.0",
    impactScope: ["citizen-journalism", "public-record"],
    excludedImpactScope: [],
    workScope: [isPublicShare ? "public-documentation" : "verified-purchase"],
    excludedWorkScope: [],
    workTimeframeStart: workStart,
    workTimeframeEnd: workEnd,
    impactTimeframeStart: workStart,
    impactTimeframeEnd: workEnd,
    contributors: [params.witnessAddress],
    rights: ["Public Display"],
    excludedRights: [],
  });

  if (!valid || !data) {
    throw new Error(`Invalid hypercert data: ${JSON.stringify(errors)}`);
  }

  const txHash = await client.mintHypercert({
    metaData: data,
    totalUnits: BigInt(1),
    transferRestriction: TransferRestrictions.AllowAll,
  });

  return txHash as string;
}
