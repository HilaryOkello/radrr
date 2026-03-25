/**
 * Storacha (w3up / Filecoin) integration.
 * Uploads video to Filecoin and returns the content CID.
 */

import * as Client from "@storacha/client";
import { StoreMemory } from "@storacha/client/stores/memory";
import { importDAG } from "@ucanto/core/delegation";
import { CarReader } from "@ipld/car";

let storachaClient: Client.Client | null = null;

/**
 * Get or initialise the Storacha client.
 * The STORACHA_PROOF env var is a base64-encoded CAR file containing
 * the UCAN delegation from the space to the server agent.
 *
 * Setup (one-time, run via CLI):
 *   npx w3 login <email>
 *   npx w3 space create radrr-space
 *   npx w3 delegation create <server-did> --can 'store/add' --can 'upload/add' | base64
 */
async function getClient(): Promise<Client.Client> {
  if (storachaClient) return storachaClient;

  const store = new StoreMemory();
  storachaClient = await Client.create({ store });

  // Load delegation proof from environment
  const proofBase64 = process.env.STORACHA_PROOF;
  if (!proofBase64) {
    throw new Error("STORACHA_PROOF env var not set");
  }

  const proofBytes = Buffer.from(proofBase64, "base64");
  const blocks: import("@ucanto/interface").Block[] = [];
  const reader = await CarReader.fromBytes(proofBytes);
  for await (const block of reader.blocks()) {
    blocks.push(block as import("@ucanto/interface").Block);
  }
  const delegation = await importDAG(blocks as unknown as Iterable<import("@ucanto/interface").Block<unknown, number, number, 1>>);
  const space = await storachaClient.addSpace(delegation);
  await storachaClient.setCurrentSpace(space.did());

  return storachaClient;
}

/**
 * Upload a video file to Storacha/Filecoin.
 * Returns the root CID string.
 */
export async function uploadVideo(
  videoBuffer: Buffer,
  filename: string
): Promise<string> {
  const client = await getClient();
  const file = new File([videoBuffer], filename, { type: "video/webm" });
  const cid = await client.uploadFile(file);
  return cid.toString();
}

/**
 * Upload encrypted video bytes to Storacha.
 */
export async function uploadEncryptedVideo(
  encryptedBytes: Buffer,
  recordingId: string
): Promise<string> {
  const client = await getClient();
  const file = new File(
    [encryptedBytes],
    `${recordingId}_encrypted.bin`,
    { type: "application/octet-stream" }
  );
  const cid = await client.uploadFile(file);
  return cid.toString();
}
