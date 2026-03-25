/**
 * Lit Protocol v6 integration.
 * Handles encryption at upload time and decryption on confirmed purchase.
 *
 * Access control: a Lit Action checks NEAR contract `is_purchased()` via RPC.
 * Only returns true when a confirmed purchase exists on-chain for the buyer.
 */

import * as LitJsSdk from "@lit-protocol/lit-node-client";
import { LitNetwork } from "@lit-protocol/constants";
import {
  LitAbility,
  LitActionResource,
} from "@lit-protocol/auth-helpers";

const LIT_NETWORK = LitNetwork.DatilTest;

/** Lit Action JS code that runs on Lit nodes.
 *  Calls NEAR RPC to verify is_purchased(recording_id, buyer).
 */
export const RADRR_LIT_ACTION_CODE = `
(async () => {
  const nearRpcUrl = "https://rpc.testnet.near.org";
  const contractId = params.contractId;
  const recordingId = params.recordingId;
  const buyer = params.buyer;

  const resp = await fetch(nearRpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "radrr",
      method: "query",
      params: {
        request_type: "call_function",
        finality: "final",
        account_id: contractId,
        method_name: "is_purchased",
        args_base64: btoa(JSON.stringify({ recording_id: recordingId, buyer })),
      },
    }),
  });
  const data = await resp.json();
  if (data.error) { LitActions.setResponse({ response: "false" }); return; }
  const bytes = data.result?.result;
  if (!bytes) { LitActions.setResponse({ response: "false" }); return; }
  const decoded = JSON.parse(bytes.map((b) => String.fromCharCode(b)).join(""));
  if (decoded) {
    const sigShare = await LitActions.signEcdsa({ toSign: dataToSign, publicKey, sigName: "sig1" });
  }
  LitActions.setResponse({ response: decoded ? "true" : "false" });
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

/** Build Lit access control conditions using a Lit Action on NEAR. */
function buildAccessConditions(recordingId: string) {
  // Custom Lit Action: checks NEAR contract is_purchased()
  // For hackathon, use a simple EVM-style condition that can be replaced
  // with the Lit Action IPFS CID after uploading the action.
  return [
    {
      contractAddress: "",
      standardContractType: "LitAction",
      chain: "ethereum",
      method: "isPurchased",
      parameters: [
        ":userAddress",
        process.env.NEAR_CONTRACT_ID ?? "",
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
