/**
 * Filecoin FVM integration — viem client.
 * Replaces lib/near.ts. All server-side contract calls go through here.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  type Address,
  type Hash,
  type Abi,
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

// ─── ABI (JSON format — required for tuple + array return types) ─────────────

const RECORDING_TUPLE = {
  type: "tuple",
  components: [
    { name: "recordingId",          type: "string"   },
    { name: "merkleRoot",           type: "string"   },
    { name: "gpsApprox",            type: "string"   },
    { name: "timestamp",            type: "uint256"  },
    { name: "cid",                  type: "string"   },
    { name: "encryptedCid",         type: "string"   },
    { name: "witness",              type: "address"  },
    { name: "title",                type: "string"   },
    { name: "description",          type: "string"   },
    { name: "previewCid",           type: "string"   },
    { name: "priceWei",             type: "uint256"  },
    { name: "sold",                 type: "bool"     },
    { name: "buyer",                type: "address"  },
    { name: "corroborationBundle",  type: "string[]" },
  ],
} as const;

const RADRR_ABI = [
  { type: "function", name: "anchorRecording",    stateMutability: "nonpayable", inputs: [{ type: "string" }, { type: "string" }, { type: "string" }, { type: "string" }, { type: "uint256" }], outputs: [] },
  { type: "function", name: "anchorRecordingFor", stateMutability: "nonpayable", inputs: [{ type: "string" }, { type: "string" }, { type: "string" }, { type: "string" }, { type: "string" }, { type: "string" }, { type: "uint256" }, { type: "address" }], outputs: [] },
  { type: "function", name: "updateCid",          stateMutability: "nonpayable", inputs: [{ type: "string" }, { type: "string" }], outputs: [] },
  { type: "function", name: "updateEncryptedCid", stateMutability: "nonpayable", inputs: [{ type: "string" }, { type: "string" }], outputs: [] },
  { type: "function", name: "updateCorroboration",stateMutability: "nonpayable", inputs: [{ type: "string" }, { type: "string[]" }], outputs: [] },
  { type: "function", name: "incrementCredibility",stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [] },
  { type: "function", name: "isPurchased",        stateMutability: "view",        inputs: [{ type: "string" }, { type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "getRecording",       stateMutability: "view",        inputs: [{ type: "string" }], outputs: [RECORDING_TUPLE] },
  { type: "function", name: "getRecordings",      stateMutability: "view",        inputs: [{ type: "uint256" }, { type: "uint256" }], outputs: [{ ...RECORDING_TUPLE, type: "tuple[]" }] },
  { type: "function", name: "getRecordingsByWitness", stateMutability: "view",    inputs: [{ type: "address" }], outputs: [{ ...RECORDING_TUPLE, type: "tuple[]" }] },
  { type: "function", name: "getRecordingsByGps", stateMutability: "view",        inputs: [{ type: "string" }], outputs: [{ type: "string[]" }] },
  { type: "function", name: "getIdentity",        stateMutability: "view",        inputs: [{ type: "address" }], outputs: [{ type: "tuple", components: [{ name: "account", type: "address" }, { name: "pseudonym", type: "string" }, { name: "credibilityScore", type: "uint256" }, { name: "recordingCount", type: "uint256" }, { name: "totalSales", type: "uint256" }] }] },
  { type: "function", name: "totalRecordings",    stateMutability: "view",        inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "placeBidFor",        stateMutability: "payable",     inputs: [{ type: "string" }, { type: "address" }], outputs: [] },
  { type: "function", name: "acceptBidFor",       stateMutability: "nonpayable",  inputs: [{ type: "string" }, { type: "uint256" }, { type: "address" }], outputs: [] },
  { type: "function", name: "rejectBidFor",       stateMutability: "nonpayable",  inputs: [{ type: "string" }, { type: "uint256" }, { type: "address" }], outputs: [] },
  { type: "function", name: "withdrawBidFor",     stateMutability: "nonpayable",  inputs: [{ type: "string" }, { type: "uint256" }, { type: "address" }], outputs: [] },
  { type: "function", name: "getBids",            stateMutability: "view",        inputs: [{ type: "string" }], outputs: [{ type: "tuple[]", components: [{ name: "bidder", type: "address" }, { name: "amount", type: "uint256" }, { name: "timestamp", type: "uint256" }, { name: "status", type: "uint8" }] }] },
] as const satisfies Abi;

const AGENT_REGISTRY_ABI = [
  { type: "function", name: "registerAgent",      stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "string" }, { type: "string" }, { type: "string[]" }, { type: "string" }], outputs: [] },
  { type: "function", name: "recordTaskSuccess",  stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "string" }], outputs: [] },
  { type: "function", name: "recordTaskFailure",  stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "string" }], outputs: [] },
  { type: "function", name: "issueCredential",    stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "string" }, { type: "string" }], outputs: [] },
  { type: "function", name: "getAgentReputation", stateMutability: "view",       inputs: [{ type: "address" }], outputs: [{ type: "tuple", components: [{ name: "score", type: "uint256" }, { name: "tasksCompleted", type: "uint256" }, { name: "tasksFailed", type: "uint256" }, { name: "lastUpdated", type: "uint256" }] }] },
  { type: "function", name: "hasCredential",      stateMutability: "view",       inputs: [{ type: "address" }, { type: "string" }], outputs: [{ type: "bool" }] },
] as const satisfies Abi;

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
    batch: { multicall: false }, // Multicall3 not deployed on Filecoin Calibration
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
  recordingId:  string;
  merkleRoot:   string;
  gpsApprox:    string;
  title:        string;
  description?: string;
  previewCid?:  string;
  priceEth?:    string;
  witness?:     string;  // user's wallet; if provided, uses anchorRecordingFor
}): Promise<Hash> {
  const wallet = getPlatformWalletClient();
  const priceWei = parseEther(params.priceEth ?? "0.001");

  if (params.witness) {
    return wallet.writeContract({
      address: CONTRACT_ADDRESS,
      abi:     RADRR_ABI,
      functionName: "anchorRecordingFor",
      args: [
        params.recordingId,
        params.merkleRoot,
        normalizeGps(params.gpsApprox),
        params.title,
        params.description ?? "",
        params.previewCid ?? "",
        priceWei,
        params.witness as Address,
      ],
    });
  }

  return wallet.writeContract({
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

// ─── Bid calls ───────────────────────────────────────────────────────────────

export async function placeBid(recordingId: string, bidder: string, amountWei: bigint): Promise<Hash> {
  const wallet = getPlatformWalletClient();
  return wallet.writeContract({
    address: CONTRACT_ADDRESS,
    abi: RADRR_ABI,
    functionName: "placeBidFor",
    args: [recordingId, bidder as Address],
    value: amountWei,
  });
}

export async function acceptBid(recordingId: string, bidIndex: number, witness: string): Promise<Hash> {
  const wallet = getPlatformWalletClient();
  return wallet.writeContract({
    address: CONTRACT_ADDRESS,
    abi: RADRR_ABI,
    functionName: "acceptBidFor",
    args: [recordingId, BigInt(bidIndex), witness as Address],
  });
}

export async function rejectBid(recordingId: string, bidIndex: number, witness: string): Promise<Hash> {
  const wallet = getPlatformWalletClient();
  return wallet.writeContract({
    address: CONTRACT_ADDRESS,
    abi: RADRR_ABI,
    functionName: "rejectBidFor",
    args: [recordingId, BigInt(bidIndex), witness as Address],
  });
}

export async function withdrawBid(recordingId: string, bidIndex: number, bidder: string): Promise<Hash> {
  const wallet = getPlatformWalletClient();
  return wallet.writeContract({
    address: CONTRACT_ADDRESS,
    abi: RADRR_ABI,
    functionName: "withdrawBidFor",
    args: [recordingId, BigInt(bidIndex), bidder as Address],
  });
}

export async function getBids(recordingId: string) {
  const client = getPublicClient();
  return client.readContract({
    address: CONTRACT_ADDRESS,
    abi: RADRR_ABI,
    functionName: "getBids",
    args: [recordingId],
  });
}
