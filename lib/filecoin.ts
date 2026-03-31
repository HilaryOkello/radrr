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

// Inlined ABI from Radrr.sol (Hardhat artifact) — matched to code expectations
const RADRR_ABI = [
  {
    "type": "function",
    "name": "acceptBidFor",
    "inputs": [
      { "internalType": "string", "name": "recordingId", "type": "string" },
      { "internalType": "uint256", "name": "bidIndex", "type": "uint256" },
      { "internalType": "address", "name": "witness", "type": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "anchorRecording",
    "inputs": [
      { "internalType": "string", "name": "recordingId", "type": "string" },
      { "internalType": "string", "name": "merkleRoot", "type": "string" },
      { "internalType": "string", "name": "gpsApprox", "type": "string" },
      { "internalType": "string", "name": "title", "type": "string" },
      { "internalType": "string", "name": "trailerCid", "type": "string" },
      { "internalType": "string", "name": "visibilityLevel", "type": "string" },
      { "internalType": "string", "name": "licenseType", "type": "string" },
      { "internalType": "uint256", "name": "priceWei", "type": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "anchorRecordingFor",
    "inputs": [
      { "internalType": "string", "name": "recordingId", "type": "string" },
      { "internalType": "string", "name": "merkleRoot", "type": "string" },
      { "internalType": "string", "name": "gpsApprox", "type": "string" },
      { "internalType": "string", "name": "title", "type": "string" },
      { "internalType": "string", "name": "description", "type": "string" },
      { "internalType": "string", "name": "previewCid", "type": "string" },
      { "internalType": "string", "name": "trailerCid", "type": "string" },
      { "internalType": "string", "name": "visibilityLevel", "type": "string" },
      { "internalType": "string", "name": "licenseType", "type": "string" },
      { "internalType": "uint256", "name": "priceWei", "type": "uint256" },
      { "internalType": "address", "name": "witness", "type": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getBids",
    "inputs": [{ "internalType": "string", "name": "recordingId", "type": "string" }],
    "outputs": [{
      "internalType": "struct Radrr.Bid[]",
      "name": "",
      "type": "tuple[]",
      "components": [
        { "internalType": "address", "name": "bidder", "type": "address" },
        { "internalType": "uint256", "name": "amount", "type": "uint256" },
        { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
        { "internalType": "uint8", "name": "status", "type": "uint8" }
      ]
    }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getIdentity",
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "outputs": [{
      "internalType": "struct Radrr.Identity",
      "name": "",
      "type": "tuple",
      "components": [
        { "internalType": "address", "name": "account", "type": "address" },
        { "internalType": "string", "name": "pseudonym", "type": "string" },
        { "internalType": "uint256", "name": "credibilityScore", "type": "uint256" },
        { "internalType": "uint256", "name": "recordingCount", "type": "uint256" },
        { "internalType": "uint256", "name": "totalSales", "type": "uint256" }
      ]
    }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRecording",
    "inputs": [{ "internalType": "string", "name": "recordingId", "type": "string" }],
    "outputs": [{
      "internalType": "struct Radrr.Recording",
      "name": "",
      "type": "tuple",
      "components": [
        { "internalType": "string", "name": "recordingId", "type": "string" },
        { "internalType": "string", "name": "merkleRoot", "type": "string" },
        { "internalType": "string", "name": "gpsApprox", "type": "string" },
        { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
        { "internalType": "string", "name": "cid", "type": "string" },
        { "internalType": "string", "name": "encryptedCid", "type": "string" },
        { "internalType": "string", "name": "keyCid", "type": "string" },
        { "internalType": "address", "name": "witness", "type": "address" },
        { "internalType": "string", "name": "title", "type": "string" },
        { "internalType": "string", "name": "description", "type": "string" },
        { "internalType": "string", "name": "previewCid", "type": "string" },
        { "internalType": "string", "name": "trailerCid", "type": "string" },
        { "internalType": "string", "name": "visibilityLevel", "type": "string" },
        { "internalType": "string", "name": "licenseType", "type": "string" },
        { "internalType": "uint256", "name": "priceWei", "type": "uint256" },
        { "internalType": "bool", "name": "sold", "type": "bool" },
        { "internalType": "address", "name": "buyer", "type": "address" },
        { "internalType": "string[]", "name": "corroborationBundle", "type": "string[]" }
      ]
    }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRecordings",
    "inputs": [
      { "internalType": "uint256", "name": "fromIndex", "type": "uint256" },
      { "internalType": "uint256", "name": "limit", "type": "uint256" }
    ],
    "outputs": [{
      "internalType": "struct Radrr.Recording[]",
      "name": "",
      "type": "tuple[]",
      "components": [
        { "internalType": "string", "name": "recordingId", "type": "string" },
        { "internalType": "string", "name": "merkleRoot", "type": "string" },
        { "internalType": "string", "name": "gpsApprox", "type": "string" },
        { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
        { "internalType": "string", "name": "cid", "type": "string" },
        { "internalType": "string", "name": "encryptedCid", "type": "string" },
        { "internalType": "string", "name": "keyCid", "type": "string" },
        { "internalType": "address", "name": "witness", "type": "address" },
        { "internalType": "string", "name": "title", "type": "string" },
        { "internalType": "string", "name": "description", "type": "string" },
        { "internalType": "string", "name": "previewCid", "type": "string" },
        { "internalType": "string", "name": "trailerCid", "type": "string" },
        { "internalType": "string", "name": "visibilityLevel", "type": "string" },
        { "internalType": "string", "name": "licenseType", "type": "string" },
        { "internalType": "uint256", "name": "priceWei", "type": "uint256" },
        { "internalType": "bool", "name": "sold", "type": "bool" },
        { "internalType": "address", "name": "buyer", "type": "address" },
        { "internalType": "string[]", "name": "corroborationBundle", "type": "string[]" }
      ]
    }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRecordingsByGps",
    "inputs": [{ "internalType": "string", "name": "gpsApprox", "type": "string" }],
    "outputs": [{ "internalType": "string[]", "name": "", "type": "string[]" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getRecordingsByWitness",
    "inputs": [{ "internalType": "address", "name": "witness", "type": "address" }],
    "outputs": [{
      "internalType": "struct Radrr.Recording[]",
      "name": "",
      "type": "tuple[]",
      "components": [
        { "internalType": "string", "name": "recordingId", "type": "string" },
        { "internalType": "string", "name": "merkleRoot", "type": "string" },
        { "internalType": "string", "name": "gpsApprox", "type": "string" },
        { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
        { "internalType": "string", "name": "cid", "type": "string" },
        { "internalType": "string", "name": "encryptedCid", "type": "string" },
        { "internalType": "string", "name": "keyCid", "type": "string" },
        { "internalType": "address", "name": "witness", "type": "address" },
        { "internalType": "string", "name": "title", "type": "string" },
        { "internalType": "string", "name": "description", "type": "string" },
        { "internalType": "string", "name": "previewCid", "type": "string" },
        { "internalType": "string", "name": "trailerCid", "type": "string" },
        { "internalType": "string", "name": "visibilityLevel", "type": "string" },
        { "internalType": "string", "name": "licenseType", "type": "string" },
        { "internalType": "uint256", "name": "priceWei", "type": "uint256" },
        { "internalType": "bool", "name": "sold", "type": "bool" },
        { "internalType": "address", "name": "buyer", "type": "address" },
        { "internalType": "string[]", "name": "corroborationBundle", "type": "string[]" }
      ]
    }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "incrementCredibility",
    "inputs": [
      { "internalType": "address", "name": "account", "type": "address" },
      { "internalType": "uint256", "name": "points", "type": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "isPurchased",
    "inputs": [
      { "internalType": "string", "name": "recordingId", "type": "string" },
      { "internalType": "address", "name": "buyer", "type": "address" }
    ],
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "placeBidFor",
    "inputs": [
      { "internalType": "string", "name": "recordingId", "type": "string" },
      { "internalType": "address", "name": "bidder", "type": "address" }
    ],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "platformWallet",
    "inputs": [],
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "purchase",
    "inputs": [{ "internalType": "string", "name": "recordingId", "type": "string" }],
    "outputs": [],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "registerIdentity",
    "inputs": [{ "internalType": "string", "name": "pseudonym", "type": "string" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "rejectBidFor",
    "inputs": [
      { "internalType": "string", "name": "recordingId", "type": "string" },
      { "internalType": "uint256", "name": "bidIndex", "type": "uint256" },
      { "internalType": "address", "name": "witness", "type": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "safetyFundWallet",
    "inputs": [],
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "totalRecordings",
    "inputs": [],
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "updateCid",
    "inputs": [
      { "internalType": "string", "name": "recordingId", "type": "string" },
      { "internalType": "string", "name": "cid", "type": "string" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "updateCorroboration",
    "inputs": [
      { "internalType": "string", "name": "recordingId", "type": "string" },
      { "internalType": "string[]", "name": "bundleIds", "type": "string[]" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "updateEncryptedCid",
    "inputs": [
      { "internalType": "string", "name": "recordingId", "type": "string" },
      { "internalType": "string", "name": "encryptedCid", "type": "string" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "updateKeyCid",
    "inputs": [
      { "internalType": "string", "name": "recordingId", "type": "string" },
      { "internalType": "string", "name": "keyCid", "type": "string" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "withdrawBidFor",
    "inputs": [
      { "internalType": "string", "name": "recordingId", "type": "string" },
      { "internalType": "uint256", "name": "bidIndex", "type": "uint256" },
      { "internalType": "address", "name": "bidder", "type": "address" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
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

// Lazy getters to ensure env vars are loaded when functions are called
const getContractAddress = () => {
  const addr = process.env.FILECOIN_CONTRACT_ADDRESS as Address;
  if (!addr) {
    throw new Error("FILECOIN_CONTRACT_ADDRESS not set in environment");
  }
  return addr;
};

const getAgentRegistryAddress = () => {
  const addr = process.env.FILECOIN_AGENT_REGISTRY_ADDRESS as Address;
  if (!addr) {
    throw new Error("FILECOIN_AGENT_REGISTRY_ADDRESS not set in environment");
  }
  return addr;
};

const getPlatformPrivateKey = () => process.env.EVM_PLATFORM_PRIVATE_KEY as `0x${string}`;
const getAgentPrivateKey = () => process.env.FILECOIN_AGENT_PRIVATE_KEY as `0x${string}`;
const RPC_URL = process.env.FILECOIN_RPC_URL ?? "https://api.calibration.node.glif.io/rpc/v1";

function getPublicClient() {
  return createPublicClient({
    chain: filecoinCalibration,
    transport: http(RPC_URL),
    batch: { multicall: false }, // Multicall3 not deployed on Filecoin Calibration
  });
}

function getPlatformWalletClient() {
  const account = privateKeyToAccount(getPlatformPrivateKey());
  return createWalletClient({
    account,
    chain: filecoinCalibration,
    transport: http(RPC_URL),
  });
}

function getAgentWalletClient() {
  const key = getAgentPrivateKey() || getPlatformPrivateKey();
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
  recordingId:      string;
  merkleRoot:       string;
  gpsApprox:        string;
  title:            string;
  description?:     string;
  previewCid?:      string;
  trailerCid?:      string;
  visibilityLevel?:  string;
  licenseType?:     string;
  priceEth?:        string;
  witness?:         string;
}): Promise<Hash> {
  const wallet = getPlatformWalletClient();
  const priceWei = parseEther(params.priceEth ?? "0.001");

  if (params.witness) {
    return wallet.writeContract({
      address: getContractAddress(),
      abi:     RADRR_ABI,
      functionName: "anchorRecordingFor",
      args: [
        params.recordingId,
        params.merkleRoot,
        normalizeGps(params.gpsApprox),
        params.title,
        params.description ?? "",
        params.previewCid ?? "",
        params.trailerCid ?? "",
        params.visibilityLevel ?? "blur",
        params.licenseType ?? "non_exclusive",
        priceWei,
        params.witness as Address,
      ],
    });
  }

  return wallet.writeContract({
    address: getContractAddress(),
    abi:     RADRR_ABI,
    functionName: "anchorRecording",
    args: [
      params.recordingId,
      params.merkleRoot,
      normalizeGps(params.gpsApprox),
      params.title,
      params.trailerCid ?? "",
      params.visibilityLevel ?? "blur",
      params.licenseType ?? "non_exclusive",
      priceWei,
    ],
  });
}

export async function updateCid(recordingId: string, cid: string): Promise<Hash> {
  const wallet = getPlatformWalletClient();
  return wallet.writeContract({
    address: getContractAddress(),
    abi: RADRR_ABI,
    functionName: "updateCid",
    args: [recordingId, cid],
  });
}

export async function updateEncryptedCid(recordingId: string, encryptedCid: string): Promise<Hash> {
  const wallet = getPlatformWalletClient();
  return wallet.writeContract({
    address: getContractAddress(),
    abi: RADRR_ABI,
    functionName: "updateEncryptedCid",
    args: [recordingId, encryptedCid],
  });
}

export async function updateKeyCid(recordingId: string, keyCid: string): Promise<Hash> {
  const wallet = getPlatformWalletClient();
  return wallet.writeContract({
    address: getContractAddress(),
    abi: RADRR_ABI,
    functionName: "updateKeyCid",
    args: [recordingId, keyCid],
  });
}

export async function updateCorroboration(recordingId: string, bundleIds: string[]): Promise<Hash> {
  const wallet = getAgentWalletClient();
  return wallet.writeContract({
    address: getContractAddress(),
    abi: RADRR_ABI,
    functionName: "updateCorroboration",
    args: [recordingId, bundleIds],
  });
}

export async function incrementCredibility(account: string, points: number): Promise<Hash> {
  const wallet = getPlatformWalletClient();
  return wallet.writeContract({
    address: getContractAddress(),
    abi: RADRR_ABI,
    functionName: "incrementCredibility",
    args: [account as Address, BigInt(points)],
  });
}

export async function isPurchased(recordingId: string, buyer: string): Promise<boolean> {
  const client = getPublicClient();
  return client.readContract({
    address: getContractAddress(),
    abi: RADRR_ABI,
    functionName: "isPurchased",
    args: [recordingId, buyer as Address],
  }) as Promise<boolean>;
}

export async function getRecordings(fromIndex = 0, limit = 20): Promise<readonly any[]> {
  const client = getPublicClient();
  return client.readContract({
    address: getContractAddress(),
    abi: RADRR_ABI,
    functionName: "getRecordings",
    args: [BigInt(fromIndex), BigInt(limit)],
  }) as Promise<readonly any[]>;
}

export async function getRecording(recordingId: string): Promise<any> {
  const client = getPublicClient();
  return client.readContract({
    address: getContractAddress(),
    abi: RADRR_ABI,
    functionName: "getRecording",
    args: [recordingId],
  });
}

export async function getRecordingsByWitness(witness: string): Promise<readonly any[]> {
  const client = getPublicClient();
  return client.readContract({
    address: getContractAddress(),
    abi: RADRR_ABI,
    functionName: "getRecordingsByWitness",
    args: [witness as Address],
  }) as Promise<readonly any[]>;
}

export async function getPublicRecordings(fromIndex = 0, limit = 20): Promise<readonly any[]> {
  const client = getPublicClient();
  const allRecordings = await client.readContract({
    address: getContractAddress(),
    abi: RADRR_ABI,
    functionName: "getRecordings",
    args: [BigInt(fromIndex), BigInt(limit)],
  }) as readonly any[];
  return allRecordings.filter(
    (r) => r.visibilityLevel === "full"
  );
}

export async function getRecordingsByBuyer(buyer: string) {
  const client = getPublicClient();
  const allRecordings = await client.readContract({
    address: getContractAddress(),
    abi: RADRR_ABI,
    functionName: "getRecordings",
    args: [BigInt(0), BigInt(100)],
  });
  const buyerLower = buyer.toLowerCase();
  return (allRecordings as readonly Record<string, unknown>[]).filter(
    (r) => {
      const rec = r as Record<string, unknown>;
      return typeof rec.buyer === "string" && rec.buyer.toLowerCase() === buyerLower;
    }
  );
}

export async function getRecordingsByGps(gpsApprox: string): Promise<readonly string[]> {
  const client = getPublicClient();
  return client.readContract({
    address: getContractAddress(),
    abi: RADRR_ABI,
    functionName: "getRecordingsByGps",
    args: [normalizeGps(gpsApprox)],
  }) as Promise<readonly string[]>;
}

export async function getIdentity(account: string) {
  const client = getPublicClient();
  return client.readContract({
    address: getContractAddress(),
    abi: RADRR_ABI,
    functionName: "getIdentity",
    args: [account as Address],
  });
}

// ─── ERC-8004 Agent Registry calls ──────────────────────────────────────────

export async function recordAgentTaskSuccess(agentAddress: string, reason: string): Promise<Hash> {
  const wallet = getPlatformWalletClient();
  return wallet.writeContract({
    address: getAgentRegistryAddress(),
    abi: AGENT_REGISTRY_ABI,
    functionName: "recordTaskSuccess",
    args: [agentAddress as Address, reason],
  });
}

export async function recordAgentTaskFailure(agentAddress: string, reason: string): Promise<Hash> {
  const wallet = getPlatformWalletClient();
  return wallet.writeContract({
    address: getAgentRegistryAddress(),
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
    address: getAgentRegistryAddress(),
    abi: AGENT_REGISTRY_ABI,
    functionName: "issueCredential",
    args: [agentAddress as Address, credentialType, evidenceCid],
  });
}

export async function getAgentReputation(agentAddress: string) {
  const client = getPublicClient();
  return client.readContract({
    address: getAgentRegistryAddress(),
    abi: AGENT_REGISTRY_ABI,
    functionName: "getAgentReputation",
    args: [agentAddress as Address],
  });
}

export async function hasAgentCredential(agentAddress: string, credentialType: string): Promise<boolean> {
  const client = getPublicClient();
  return client.readContract({
    address: getAgentRegistryAddress(),
    abi: AGENT_REGISTRY_ABI,
    functionName: "hasCredential",
    args: [agentAddress as Address, credentialType],
  });
}

// ─── Bid calls ───────────────────────────────────────────────────────────────

export async function placeBid(recordingId: string, bidder: string, amountWei: bigint): Promise<Hash> {
  const wallet = getPlatformWalletClient();
  return wallet.writeContract({
    address: getContractAddress(),
    abi: RADRR_ABI,
    functionName: "placeBidFor",
    args: [recordingId, bidder as Address],
    value: amountWei,
  });
}

export async function acceptBid(recordingId: string, bidIndex: number, witness: string): Promise<Hash> {
  const wallet = getPlatformWalletClient();
  return wallet.writeContract({
    address: getContractAddress(),
    abi: RADRR_ABI,
    functionName: "acceptBidFor",
    args: [recordingId, BigInt(bidIndex), witness as Address],
  });
}

export async function rejectBid(recordingId: string, bidIndex: number, witness: string): Promise<Hash> {
  const wallet = getPlatformWalletClient();
  return wallet.writeContract({
    address: getContractAddress(),
    abi: RADRR_ABI,
    functionName: "rejectBidFor",
    args: [recordingId, BigInt(bidIndex), witness as Address],
  });
}

export async function withdrawBid(recordingId: string, bidIndex: number, bidder: string): Promise<Hash> {
  const wallet = getPlatformWalletClient();
  return wallet.writeContract({
    address: getContractAddress(),
    abi: RADRR_ABI,
    functionName: "withdrawBidFor",
    args: [recordingId, BigInt(bidIndex), bidder as Address],
  });
}

export async function getBids(recordingId: string) {
  const client = getPublicClient();
  return client.readContract({
    address: getContractAddress(),
    abi: RADRR_ABI,
    functionName: "getBids",
    args: [recordingId],
  });
}

export async function getBidsByBidder(bidder: string) {
  const client = getPublicClient();
  const allRecordings = await client.readContract({
    address: getContractAddress(),
    abi: RADRR_ABI,
    functionName: "getRecordings",
    args: [BigInt(0), BigInt(100)],
  });
  
  const bidderLower = bidder.toLowerCase();
  const result: Array<{
    recordingId: string;
    title: string;
    bidIndex: number;
    amount: bigint;
    timestamp: bigint;
    status: number;
  }> = [];
  
  for (const rec of allRecordings as readonly Record<string, unknown>[]) {
    const recObj = rec as Record<string, unknown>;
    const recordingId = recObj.recordingId as string;
    if (!recordingId) continue;
    
    const bids = await getBids(recordingId) as Array<{ bidder: string; amount: bigint; timestamp: bigint; status: number }>;
    
    for (let i = 0; i < bids.length; i++) {
      if (bids[i].bidder.toLowerCase() === bidderLower) {
        result.push({
          recordingId,
          title: recObj.title as string || "Untitled",
          bidIndex: i,
          amount: bids[i].amount,
          timestamp: bids[i].timestamp,
          status: bids[i].status,
        });
      }
    }
  }
  
  return result;
}
