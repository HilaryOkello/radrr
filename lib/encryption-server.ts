/**
 * Server-side encryption functions for RADRR.
 * These run only on the server and can access sensitive resources like STORACHA_PROOF.
 */

import { uploadJson } from "./storacha";

/**
 * Upload encrypted key to IPFS via Storacha.
 * Returns the IPFS CID of the encrypted key.
 */
export async function uploadKeyToIpfs(
  encryptedKey: string,
  keyHash: string,
  recordingId: string
): Promise<string> {
  const keyData = {
    encryptedKey,
    keyHash,
    recordingId,
    timestamp: Date.now(),
  };

  const keyCid = await uploadJson(keyData, `${recordingId}_key.json`);
  return keyCid;
}

/**
 * Fetch encrypted key data from IPFS.
 */
export async function fetchKeyFromIpfs(keyCid: string): Promise<{
  encryptedKey: string;
  keyHash: string;
  recordingId: string;
  timestamp: number;
} | null> {
  try {
    const response = await fetch(`https://${keyCid}.ipfs.w3s.link`);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Decrypt XOR-encrypted key using server secret.
 */
export function decryptKeyWithSecret(encryptedKey: string): Uint8Array {
  const secret = getMasterSecret();
  const encrypted = base64ToUint8Array(encryptedKey);
  const decrypted = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ secret[i % secret.length];
  }
  return decrypted;
}

function getMasterSecret(): Uint8Array {
  const secret = process.env.ENCRYPTION_MASTER_SECRET || "radrr-demo-secret-key-32bytes!!";
  const encoder = new TextEncoder();
  const bytes = encoder.encode(secret);
  const result = new Uint8Array(32);
  result.set(bytes.slice(0, 32));
  return result;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}