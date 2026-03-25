/**
 * Storacha (w3up / Filecoin) integration.
 * Uploads video to Filecoin and returns the content CID.
 */

import * as Client from "@storacha/client";
import { StoreMemory } from "@storacha/client/stores/memory";
import * as Delegation from "@ucanto/core/delegation";
import * as ed25519 from "@ucanto/principal/ed25519";

let storachaClient: Client.Client | null = null;

async function getClient(): Promise<Client.Client> {
  if (storachaClient) return storachaClient;

  // Load stable principal so the server DID is consistent across restarts
  const principalB64 = process.env.STORACHA_PRINCIPAL;
  let principal: Awaited<ReturnType<typeof ed25519.generate>> | undefined;
  if (principalB64) {
    const bytes = new Uint8Array(Buffer.from(principalB64, "base64"));
    principal = ed25519.decode(bytes);
  }

  const store = new StoreMemory();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  storachaClient = await Client.create({ store, principal: principal as any });

  const proofBase64 = process.env.STORACHA_PROOF;
  if (!proofBase64) {
    throw new Error("STORACHA_PROOF env var not set");
  }

  // Strip any whitespace/newlines that may have crept in
  const clean = proofBase64.replace(/\s/g, "");
  const proofBytes = new Uint8Array(Buffer.from(clean, "base64"));
  const result = await Delegation.extract(proofBytes);
  if (result.error) {
    throw new Error(`Failed to parse STORACHA_PROOF: ${result.error.message}`);
  }
  const space = await storachaClient.addSpace(result.ok);
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
