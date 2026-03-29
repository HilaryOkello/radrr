/**
 * Lit Protocol V1 (Naga) integration.
 * Handles encryption at upload time and decryption on confirmed purchase.
 *
 * Access control: a Lit Action calls World Chain RPC to verify isPurchased().
 * EVM-native: no custom JSON-RPC encoding needed — standard eth_call.
 */

import * as LitJsSdk from "@lit-protocol/lit-node-client";
import { LitNetwork } from "@lit-protocol/constants";
import {
  LitAbility,
  LitActionResource,
} from "@lit-protocol/auth-helpers";

const LIT_NETWORK = LitNetwork.DatilDev;

const FILECOIN_RPC = "https://api.calibration.node.glif.io/rpc/v1";

/**
 * Lit Action: calls Filecoin FVM eth_call to verify isPurchased(recordingId, buyer).
 * Runs on Lit nodes — no secrets exposed to the server.
 */
export const RADRR_LIT_ACTION_CODE = `
(async () => {
  const contractAddress = params.contractAddress;
  const recordingId     = params.recordingId;
  const buyer           = params.buyer;
  const rpcUrl          = "${FILECOIN_RPC}";

  // ABI-encode isPurchased(string,address)
  // selector: keccak256("isPurchased(string,address)") -> first 4 bytes
  const selector = "0x67c1c258";

  // Encode string + address params (simplified ABI encoding for Lit Action)
  const recordingIdHex = Array.from(new TextEncoder().encode(recordingId))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  const buyerClean = buyer.toLowerCase().replace("0x", "").padStart(64, "0");
  const offset     = "0000000000000000000000000000000000000000000000000000000000000040";
  const len        = recordingId.length.toString(16).padStart(64, "0");
  const padded     = recordingIdHex.padEnd(Math.ceil(recordingIdHex.length / 64) * 64, "0");
  const data       = selector + offset + buyerClean + len + padded;

  const resp = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "eth_call",
      params: [{ to: contractAddress, data }, "latest"],
    }),
  });
  const json = await resp.json();
  // Result is 32-byte bool: last char "1" = true
  const purchased = json.result && json.result !== "0x" &&
    parseInt(json.result.slice(-1), 16) === 1;

  if (purchased) {
    const sigShare = await LitActions.signEcdsa({ toSign: dataToSign, publicKey, sigName: "sig1" });
  }
  LitActions.setResponse({ response: purchased ? "true" : "false" });
})();
`;

let litClient: LitJsSdk.LitNodeClient | null = null;

async function getLitClient(): Promise<LitJsSdk.LitNodeClient> {
  if (litClient?.ready) return litClient;
  litClient = new LitJsSdk.LitNodeClient({
    litNetwork: LIT_NETWORK,
    debug: false,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  // 10s timeout — if nodes unreachable, caller falls back to AES-256-GCM
  await Promise.race([
    litClient.connect(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Lit connection timeout")), 20000)
    ),
  ]);
  return litClient;
}

/** Build Lit access control conditions using a Lit Action on World Chain. */
function buildAccessConditions(recordingId: string) {
  return [
    {
      contractAddress: "",
      standardContractType: "LitAction",
      chain: "filecoin-calibration",
      method: "isPurchased",
      parameters: [
        ":userAddress",
        process.env.NEXT_PUBLIC_FILECOIN_CONTRACT_ADDRESS ?? process.env.FILECOIN_CONTRACT_ADDRESS ?? "",
        recordingId,
      ],
      returnValueTest: {
        comparator: "=",
        value: "true",
      },
    },
  ];
}

export interface EncryptResult {
  ciphertext: string;
  dataToEncryptHash: string;
}

/**
 * Encrypt video bytes using Lit Protocol.
 */
export async function encryptVideo(
  videoBytes: Uint8Array,
  recordingId: string
): Promise<EncryptResult> {
  const client = await getLitClient();
  const accessControlConditions = buildAccessConditions(recordingId);

  const { ciphertext, dataToEncryptHash } = await LitJsSdk.encryptString(
    {
      accessControlConditions,
      dataToEncrypt: Buffer.from(videoBytes).toString("base64"),
    },
    client
  );

  return { ciphertext, dataToEncryptHash };
}

/**
 * Decrypt video bytes for a verified buyer.
 */
export async function decryptVideo(params: {
  ciphertext: string;
  dataToEncryptHash: string;
  recordingId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sessionSigs: any;
}): Promise<Uint8Array> {
  const client = await getLitClient();
  const accessControlConditions = buildAccessConditions(params.recordingId);

  const decrypted = await LitJsSdk.decryptToString(
    {
      accessControlConditions,
      ciphertext: params.ciphertext,
      dataToEncryptHash: params.dataToEncryptHash,
      sessionSigs: params.sessionSigs,
      chain: "ethereum",
    },
    client
  );

  return Buffer.from(decrypted, "base64");
}

/**
 * AES-256-GCM fallback encryption for when Lit nodes are unreachable.
 * In production the AES key would be sealed by Lit Protocol and only
 * released after isPurchased() returns true on the Filecoin contract.
 * For demo: key is included in the payload (marked demo mode).
 */
export async function encryptVideoLocal(
  videoBytes: Uint8Array,
  recordingId: string
): Promise<EncryptResult & { key: string }> {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, videoBytes);

  // iv (12 bytes) + ciphertext
  const combined = new Uint8Array(12 + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), 12);

  // btoa via chunks — spread on large arrays overflows the call stack
  let binaryStr = "";
  const chunkSize = 8192;
  for (let i = 0; i < combined.length; i += chunkSize) {
    binaryStr += String.fromCharCode(...combined.subarray(i, i + chunkSize));
  }
  const ciphertext = btoa(binaryStr);

  const hashBuf = await crypto.subtle.digest("SHA-256", videoBytes);
  const dataToEncryptHash = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const rawKey = await crypto.subtle.exportKey("raw", key);
  const keyB64 = btoa(String.fromCharCode(...new Uint8Array(rawKey)));

  return { ciphertext, dataToEncryptHash, key: keyB64 };
}

/**
 * Encrypt GPS coordinates with the same access condition.
 */
export async function encryptGps(
  exactGps: string,
  recordingId: string
): Promise<EncryptResult> {
  const client = await getLitClient();
  const accessControlConditions = buildAccessConditions(recordingId);

  const { ciphertext, dataToEncryptHash } = await LitJsSdk.encryptString(
    {
      accessControlConditions,
      dataToEncrypt: exactGps,
    },
    client
  );

  return { ciphertext, dataToEncryptHash };
}
