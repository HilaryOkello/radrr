/**
 * Filecoin-native encryption using AES-256-GCM with IPFS-backed key storage.
 * 
 * This replaces Lit Protocol with a server-side key escrow model:
 * - Videos are encrypted client-side with AES-256-GCM
 * - Encryption keys are encrypted with server secret and stored on IPFS
 * - Keys are only released after on-chain purchase verification
 * - Everything stays on Filecoin Calibration (sponsor compliant)
 */

import { isPurchased } from "./filecoin";
import { uploadJson } from "./storacha";

export interface EncryptResult {
  ciphertext: string;
  iv: string;
  keyHash: string;
}

export interface EncryptedKeyData {
  encryptedKey: string;
  keyHash: string;
  recordingId: string;
  timestamp: number;
}

/**
 * Encrypt video bytes using AES-256-GCM (browser native).
 * Returns ciphertext + IV. The key is encrypted and uploaded to IPFS.
 */
export async function encryptVideoNative(
  videoBytes: Uint8Array,
  recordingId: string
): Promise<EncryptResult & { keyCid: string }> {
  // Generate AES-256 key
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt video
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    videoBytes
  );

  // Export key for server storage
  const rawKey = await crypto.subtle.exportKey("raw", key);
  const keyBytes = new Uint8Array(rawKey.slice(0));

  // Create key hash for verification (SHA-256 of key)
  const keyHashBuf = await crypto.subtle.digest("SHA-256", keyBytes.buffer);
  const keyHashArray = new Uint8Array(keyHashBuf);
  const keyHash = Array.from(keyHashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Encrypt the key itself with server's master key
  const masterSecret = getMasterSecret();
  const encryptedKey = await encryptKeyWithSecret(keyBytes, masterSecret);

  // Create key data object
  const keyData: EncryptedKeyData = {
    encryptedKey,
    keyHash,
    recordingId,
    timestamp: Date.now(),
  };

  // Upload encrypted key to IPFS via Storacha
  const keyCid = await uploadJson(keyData, `${recordingId}_key.json`);

  // Encode ciphertext as base64
  const ciphertext = arrayBufferToBase64(encrypted);

  return {
    ciphertext,
    iv: uint8ArrayToBase64(iv),
    keyHash,
    keyCid,
  };
}

/**
 * Decrypt video bytes for a verified buyer.
 * Server verifies on-chain purchase before releasing key.
 */
export async function decryptVideoNative(
  ciphertext: string,
  iv: string,
  keyCid: string,
  buyerAddress: string,
  recordingId: string
): Promise<Uint8Array> {
  // Verify purchase on-chain
  const purchased = await isPurchased(recordingId, buyerAddress);
  if (!purchased) {
    throw new Error("Purchase not verified on-chain");
  }

  // Fetch encrypted key from IPFS
  const keyData = await fetchKeyFromIpfs(keyCid);
  if (!keyData) {
    throw new Error("Encryption key not found on IPFS");
  }

  // Decrypt the key using server secret
  const masterSecret = getMasterSecret();
  const keyBytes = await decryptKeyWithSecret(keyData.encryptedKey, masterSecret);

  // Import key for decryption
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  // Decrypt video
  const ciphertextBytes = base64ToUint8Array(ciphertext);
  const ivBytes = base64ToUint8Array(iv);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    key,
    ciphertextBytes
  );

  return new Uint8Array(decrypted);
}

/**
 * Client-side decryption (after receiving key from server).
 */
export async function decryptVideoClientSide(
  ciphertext: string,
  iv: string,
  keyBase64: string
): Promise<Uint8Array> {
  const keyBytes = base64ToUint8Array(keyBase64);
  const ciphertextBytes = base64ToUint8Array(ciphertext);
  const ivBytes = base64ToUint8Array(iv);

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    key,
    ciphertextBytes
  );

  return new Uint8Array(decrypted);
}

/**
 * Release encryption key to verified buyer.
 * Called by API after on-chain purchase verification.
 */
export async function releaseEncryptionKey(
  keyCid: string,
  buyerAddress: string,
  recordingId: string
): Promise<string> {
  // Double-check purchase
  const purchased = await isPurchased(recordingId, buyerAddress);
  if (!purchased) {
    throw new Error("Purchase not verified on-chain");
  }

  // Fetch encrypted key from IPFS
  const keyData = await fetchKeyFromIpfs(keyCid);
  if (!keyData) {
    throw new Error("Key not found on IPFS");
  }

  // Decrypt key with server secret
  const masterSecret = getMasterSecret();
  const keyBytes = await decryptKeyWithSecret(keyData.encryptedKey, masterSecret);

  // Return as base64
  return uint8ArrayToBase64(keyBytes);
}

/**
 * Fetch encrypted key data from IPFS.
 */
async function fetchKeyFromIpfs(keyCid: string): Promise<EncryptedKeyData | null> {
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

// Helper functions

function getMasterSecret(): Uint8Array {
  const secret = process.env.ENCRYPTION_MASTER_SECRET || "radrr-demo-secret-key-32bytes!";
  // Pad or truncate to 32 bytes
  const encoder = new TextEncoder();
  const bytes = encoder.encode(secret);
  const result = new Uint8Array(32);
  result.set(bytes.slice(0, 32));
  return result;
}

async function encryptKeyWithSecret(
  keyBytes: Uint8Array,
  secret: Uint8Array
): Promise<string> {
  // Simple XOR encryption (use proper encryption in production)
  const encrypted = new Uint8Array(keyBytes.length);
  for (let i = 0; i < keyBytes.length; i++) {
    encrypted[i] = keyBytes[i] ^ secret[i % secret.length];
  }
  return uint8ArrayToBase64(encrypted);
}

async function decryptKeyWithSecret(
  encryptedKey: string,
  secret: Uint8Array
): Promise<Uint8Array> {
  const encrypted = base64ToUint8Array(encryptedKey);
  const decrypted = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ secret[i % secret.length];
  }
  return decrypted;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return uint8ArrayToBase64(new Uint8Array(buffer));
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Legacy exports for backward compatibility (deprecated)
export async function encryptVideo(
  _videoBytes: Uint8Array,
  _recordingId: string
): Promise<{ ciphertext: string; dataToEncryptHash: string }> {
  throw new Error("Lit Protocol removed. Use encryptVideoNative() instead.");
}

export async function decryptVideo(): Promise<Uint8Array> {
  throw new Error("Lit Protocol removed. Use decryptVideoNative() or decryptVideoClientSide() instead.");
}

export async function encryptVideoLocal(
  videoBytes: Uint8Array,
  recordingId: string
): Promise<{ ciphertext: string; dataToEncryptHash: string; key: string }> {
  // Reuse native encryption for local fallback
  const result = await encryptVideoNative(videoBytes, recordingId);
  
  // Fetch the key from IPFS and return it immediately for demo/fallback mode
  const keyData = await fetchKeyFromIpfs(result.keyCid);
  if (!keyData) throw new Error("Key not found on IPFS");
  
  const masterSecret = getMasterSecret();
  const keyBytes = await decryptKeyWithSecret(keyData.encryptedKey, masterSecret);
  const key = uint8ArrayToBase64(keyBytes);
  
  return {
    ciphertext: result.ciphertext,
    dataToEncryptHash: result.keyHash,
    key,
  };
}
