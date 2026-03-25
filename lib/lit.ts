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

const LIT_NETWORK = LitNetwork.DatilTest;

const WORLDCHAIN_RPC = "https://worldchain-sepolia.g.alchemy.com/public";

/**
 * Lit Action: calls World Chain eth_call to verify isPurchased(recordingId, buyer).
 * Runs on Lit nodes — no secrets exposed to the server.
 */
export const RADRR_LIT_ACTION_CODE = `
(async () => {
  const contractAddress = params.contractAddress;
  const recordingId     = params.recordingId;
  const buyer           = params.buyer;
  const rpcUrl          = "${WORLDCHAIN_RPC}";

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
  await litClient.connect();
  return litClient;
}

/** Build Lit access control conditions using a Lit Action on World Chain. */
function buildAccessConditions(recordingId: string) {
  return [
    {
      contractAddress: "",
      standardContractType: "LitAction",
      chain: "worldchain-sepolia",
      method: "isPurchased",
      parameters: [
        ":userAddress",
        process.env.WORLDCHAIN_CONTRACT_ADDRESS ?? "",
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
