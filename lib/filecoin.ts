/**
 * Filecoin FVM integration — viem client.
 * Replaces lib/near.ts. All server-side contract calls go through here.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseEther,
  type Address,
  type Hash,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

// ─── Chain definition ────────────────────────────────────────────────────────

export const filecoinCalibration = {
  id: 314159,
  name: "Filecoin Calibration Testnet",
  nativeCurrency: { name: "testnet FIL", symbol: "tFIL", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://api.calibration.node.glif.io/rpc/v1"] },
  },
  blockExplorers: {
    default: {
      name: "Filecoin Calibration Explorer",
      url: "https://calibration.filfox.info/en",
    },
  },
  testnet: true,
} as const;

// ─── ABI (minimal — only what we call from server) ──────────────────────────

const RADRR_ABI = parseAbi([
  "function anchorRecording(string recordingId, string merkleRoot, string gpsApprox, string title, uint256 priceWei) external",
  "function updateCid(string recordingId, string cid) external",
  "function updateEncryptedCid(string recordingId, string encryptedCid) external",
  "function updateCorroboration(string recordingId, string[] bundleIds) external",
  "function incrementCredibility(address account, uint256 points) external",
  "function isPurchased(string recordingId, address buyer) external view returns (bool)",
  "function getRecording(string recordingId) external view returns (tuple(string recordingId, string merkleRoot, string gpsApprox, uint256 timestamp, string cid, string encryptedCid, address witness, string title, uint256 priceWei, bool sold, address buyer, string[] corroborationBundle))",
  "function getRecordings(uint256 fromIndex, uint256 limit) external view returns (tuple(string recordingId, string merkleRoot, string gpsApprox, uint256 timestamp, string cid, string encryptedCid, address witness, string title, uint256 priceWei, bool sold, address buyer, string[] corroborationBundle)[])",
  "function getRecordingsByWitness(address witness) external view returns (tuple(string recordingId, string merkleRoot, string gpsApprox, uint256 timestamp, string cid, string encryptedCid, address witness, string title, uint256 priceWei, bool sold, address buyer, string[] corroborationBundle)[])",
  "function getRecordingsByGps(string gpsApprox) external view returns (string[])",
  "function getIdentity(address account) external view returns (tuple(address account, string pseudonym, uint256 credibilityScore, uint256 recordingCount, uint256 totalSales))",
  "function totalRecordings() external view returns (uint256)",
]);

const AGENT_REGISTRY_ABI = parseAbi([
  "function registerAgent(address agent, string did, string name, string[] capabilities, string metadataUri) external",
  "function recordTaskSuccess(address agent, string reason) external",
  "function recordTaskFailure(address agent, string reason) external",
  "function issueCredential(address agent, string credentialType, string evidenceCid) external",
  "function getAgentReputation(address agent) external view returns (tuple(uint256 score, uint256 tasksCompleted, uint256 tasksFailed, uint256 lastUpdated))",
  "function hasCredential(address agent, string credentialType) external view returns (bool)",
]);

// ─── Client setup ────────────────────────────────────────────────────────────

const CONTRACT_ADDRESS   = process.env.FILECOIN_CONTRACT_ADDRESS   as Address;
const AGENT_REGISTRY_ADDRESS = process.env.FILECOIN_AGENT_REGISTRY_ADDRESS as Address;
const PLATFORM_PRIVATE_KEY   = process.env.EVM_PLATFORM_PRIVATE_KEY  as `0x${string}`;
const AGENT_PRIVATE_KEY      = process.env.FILECOIN_AGENT_PRIVATE_KEY as `0x${string}`;
const RPC_URL = process.env.FILECOIN_RPC_URL ?? "https://api.calibration.node.glif.io/rpc/v1";

function getPublicClient() {
  return createPublicClient({
    chain: filecoinCalibration,
    transport: http(RPC_URL),
  });
}

function getPlatformWalletClient() {
  const account = privateKeyToAccount(PLATFORM_PRIVATE_KEY);
  return createWalletClient({
    account,
    chain: filecoinCalibration,
    transport: http(RPC_URL),
  });
}

function getAgentWalletClient() {
  const key = AGENT_PRIVATE_KEY || PLATFORM_PRIVATE_KEY;
  const account = privateKeyToAccount(key);
  return createWalletClient({
    account,
    chain: filecoinCalibration,
    transport: http(RPC_URL),
  });
}

// ─── GPS normalization (must match contract clustering) ──────────────────────

export function normalizeGps(gpsApprox: string): string {
  const parts = gpsApprox.split(",");
  if (parts.length !== 2) return gpsApprox;
  const lat = Math.round(parseFloat(parts[0]) * 10) / 10;
  const lng = Math.round(parseFloat(parts[1]) * 10) / 10;
  return `${lat.toFixed(1)},${lng.toFixed(1)}`;
}

// ─── Radrr contract calls ─────────────────────────────────────────────────────

export async function anchorRecording(params: {
  recordingId: string;
  merkleRoot:  string;
  gpsApprox:   string;
  title:       string;
  priceEth?:   string;
}): Promise<Hash> {
  const wallet = getPlatformWalletClient();
  const priceWei = parseEther(params.priceEth ?? "0.001");
  const hash = await wallet.writeContract({
    address: CONTRACT_ADDRESS,
    abi:     RADRR_ABI,
    functionName: "anchorRecording",
    args: [
      params.recordingId,
      params.merkleRoot,
      normalizeGps(params.gpsApprox),
      params.title,
      priceWei,
    ],
  });
  return hash;
}

export async function updateCid(recordingId: string, cid: string): Promise<Hash> {
  const wallet = getPlatformWalletClient();
  return wallet.writeContract({
    address: CONTRACT_ADDRESS,
    abi: RADRR_ABI,
    functionName: "updateCid",
    args: [recordingId, cid],
  });
}

export async function updateEncryptedCid(recordingId: string, encryptedCid: string): Promise<Hash> {
  const wallet = getPlatformWalletClient();
  return wallet.writeContract({
    address: CONTRACT_ADDRESS,
    abi: RADRR_ABI,
    functionName: "updateEncryptedCid",
    args: [recordingId, encryptedCid],
  });
}

export async function updateCorroboration(recordingId: string, bundleIds: string[]): Promise<Hash> {
  const wallet = getAgentWalletClient();
  return wallet.writeContract({
    address: CONTRACT_ADDRESS,
    abi: RADRR_ABI,
    functionName: "updateCorroboration",
    args: [recordingId, bundleIds],
  });
}

export async function incrementCredibility(account: string, points: number): Promise<Hash> {
  const wallet = getPlatformWalletClient();
  return wallet.writeContract({
    address: CONTRACT_ADDRESS,
    abi: RADRR_ABI,
    functionName: "incrementCredibility",
    args: [account as Address, BigInt(points)],
  });
}

export async function isPurchased(recordingId: string, buyer: string): Promise<boolean> {
  const client = getPublicClient();
  return client.readContract({
    address: CONTRACT_ADDRESS,
    abi: RADRR_ABI,
    functionName: "isPurchased",
    args: [recordingId, buyer as Address],
  });
}

export async function getRecordings(fromIndex = 0, limit = 20) {
  const client = getPublicClient();
  return client.readContract({
    address: CONTRACT_ADDRESS,
    abi: RADRR_ABI,
    functionName: "getRecordings",
    args: [BigInt(fromIndex), BigInt(limit)],
  });
}

export async function getRecordingsByWitness(witness: string) {
  const client = getPublicClient();
  return client.readContract({
    address: CONTRACT_ADDRESS,
    abi: RADRR_ABI,
    functionName: "getRecordingsByWitness",
    args: [witness as Address],
  });
}

export async function getRecordingsByGps(gpsApprox: string): Promise<readonly string[]> {
  const client = getPublicClient();
  return client.readContract({
    address: CONTRACT_ADDRESS,
    abi: RADRR_ABI,
    functionName: "getRecordingsByGps",
    args: [normalizeGps(gpsApprox)],
  });
}

export async function getIdentity(account: string) {
  const client = getPublicClient();
  return client.readContract({
    address: CONTRACT_ADDRESS,
    abi: RADRR_ABI,
    functionName: "getIdentity",
    args: [account as Address],
  });
}

// ─── ERC-8004 Agent Registry calls ──────────────────────────────────────────

export async function recordAgentTaskSuccess(agentAddress: string, reason: string): Promise<Hash> {
  const wallet = getPlatformWalletClient();
  return wallet.writeContract({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    functionName: "recordTaskSuccess",
    args: [agentAddress as Address, reason],
  });
}

export async function recordAgentTaskFailure(agentAddress: string, reason: string): Promise<Hash> {
  const wallet = getPlatformWalletClient();
  return wallet.writeContract({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    functionName: "recordTaskFailure",
    args: [agentAddress as Address, reason],
  });
}

export async function issueAgentCredential(
  agentAddress: string,
  credentialType: string,
  evidenceCid: string
): Promise<Hash> {
  const wallet = getPlatformWalletClient();
  return wallet.writeContract({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    functionName: "issueCredential",
    args: [agentAddress as Address, credentialType, evidenceCid],
  });
}

export async function getAgentReputation(agentAddress: string) {
  const client = getPublicClient();
  return client.readContract({
    address: AGENT_REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    functionName: "getAgentReputation",
    args: [agentAddress as Address],
  });
}
