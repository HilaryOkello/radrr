/**
 * NEAR Protocol integration — near-api-js v7.
 */

import {
  Account,
  JsonRpcProvider,
  KeyPair,
  KeyPairSigner,
} from "near-api-js";

const CONTRACT_ID = process.env.NEAR_CONTRACT_ID!;
const NETWORK_ID = process.env.NEAR_NETWORK_ID || "testnet";
const PLATFORM_ACCOUNT_ID = process.env.NEAR_PLATFORM_ACCOUNT_ID!;
const PLATFORM_PRIVATE_KEY = process.env.NEAR_PLATFORM_PRIVATE_KEY!;

const RPC_URL =
  NETWORK_ID === "mainnet"
    ? "https://rpc.mainnet.near.org"
    : "https://rpc.testnet.near.org";

function getProvider(): JsonRpcProvider {
  return new JsonRpcProvider({ url: RPC_URL });
}

function getPlatformAccount(): Account {
  const provider = getProvider();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const keyPair = (KeyPair as any).fromString(PLATFORM_PRIVATE_KEY);
  const signer = new KeyPairSigner(keyPair);
  const account = new Account(PLATFORM_ACCOUNT_ID, provider, signer);
  return account;
}

/** Call a view function via JSON-RPC (no signing required). */
async function viewFunction(
  methodName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const provider = getProvider();
  const result = await provider.callFunction({
    contractId: CONTRACT_ID,
    method: methodName,
    args,
  });
  return result;
}

/** Anchor a recording's Merkle root on-chain. Returns the transaction hash. */
export async function anchorRecording(params: {
  recordingId: string;
  merkleRoot: string;
  gpsApprox: string;
  title: string;
  priceNear?: string;
}): Promise<string> {
  const account = getPlatformAccount();
  const result = await account.callFunction({
    contractId: CONTRACT_ID,
    methodName: "anchor_recording",
    args: {
      recording_id: params.recordingId,
      merkle_root: params.merkleRoot,
      gps_approx: params.gpsApprox,
      title: params.title,
      price_near: params.priceNear ?? "1.0",
    },
    gas: BigInt("30000000000000"),
  });
  return String(result ?? "pending");
}

/** Link the Storacha CID to a recording. */
export async function updateCid(recordingId: string, cid: string): Promise<void> {
  const account = getPlatformAccount();
  await account.callFunction({
    contractId: CONTRACT_ID,
    methodName: "update_cid",
    args: { recording_id: recordingId, cid },
    gas: BigInt("10000000000000"),
  });
}

/** Link the encrypted CID to a recording. */
export async function updateEncryptedCid(
  recordingId: string,
  encryptedCid: string
): Promise<void> {
  const account = getPlatformAccount();
  await account.callFunction({
    contractId: CONTRACT_ID,
    methodName: "update_encrypted_cid",
    args: { recording_id: recordingId, encrypted_cid: encryptedCid },
    gas: BigInt("10000000000000"),
  });
}

/** Check if a recording has been purchased by a buyer (for Lit Protocol). */
export async function isPurchased(
  recordingId: string,
  buyer: string
): Promise<boolean> {
  return viewFunction("is_purchased", {
    recording_id: recordingId,
    buyer,
  }) as Promise<boolean>;
}

/** Get recordings for the marketplace. */
export async function getRecordings(
  fromIndex = 0,
  limit = 20
): Promise<unknown[]> {
  return viewFunction("get_recordings", {
    from_index: fromIndex,
    limit,
  }) as Promise<unknown[]>;
}

/** Get recordings by a specific witness. */
export async function getRecordingsByWitness(witness: string): Promise<unknown[]> {
  return viewFunction("get_recordings_by_witness", { witness }) as Promise<unknown[]>;
}

/** Get recordings in a GPS cluster. */
export async function getRecordingsByGps(gpsApprox: string): Promise<string[]> {
  return viewFunction("get_recordings_by_gps", {
    gps_approx: gpsApprox,
  }) as Promise<string[]>;
}

/** Update corroboration bundle. */
export async function updateCorroboration(
  recordingId: string,
  bundleIds: string[]
): Promise<void> {
  const account = getPlatformAccount();
  await account.callFunction({
    contractId: CONTRACT_ID,
    methodName: "update_corroboration",
    args: { recording_id: recordingId, bundle_ids: bundleIds },
    gas: BigInt("10000000000000"),
  });
}

/** Increment credibility score. */
export async function incrementCredibility(
  accountId: string,
  points: number
): Promise<void> {
  const account = getPlatformAccount();
  await account.callFunction({
    contractId: CONTRACT_ID,
    methodName: "increment_credibility",
    args: { account_id: accountId, points },
    gas: BigInt("10000000000000"),
  });
}
