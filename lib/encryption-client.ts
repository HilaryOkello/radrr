/**
 * Browser-safe encryption functions for RADRR.
 * These run client-side (in the browser) and do NOT import server-only modules.
 * 
 * Flow:
 * 1. Client encrypts video with AES-256-GCM (Web Crypto API)
 * 2. Client XOR-encrypts the key with the server's secret
 * 3. Client sends encrypted key to server API for IPFS upload
 * 4. Server returns keyCid which is stored on-chain
 */

export interface EncryptResult {
  ciphertext: string;
  iv: string;
  keyHash: string;
  encryptedKey: string;
}

export interface EncryptedKeyData {
  encryptedKey: string;
  keyHash: string;
  recordingId: string;
  timestamp: number;
}

/**
 * Get server secret for XOR encryption.
 * This is the same secret used server-side.
 * Note: In production, consider fetching this from a secure endpoint.
 */
function getServerSecret(): Uint8Array {
  const secret = "radrr-demo-secret-key-32bytes!!";
  const encoder = new TextEncoder();
  const bytes = encoder.encode(secret);
  const result = new Uint8Array(32);
  result.set(bytes.slice(0, 32));
  return result;
}

/**
 * XOR-encrypt a key with the server secret.
 */
function xorEncryptKey(keyBytes: Uint8Array, secret: Uint8Array): Uint8Array {
  const encrypted = new Uint8Array(keyBytes.length);
  for (let i = 0; i < keyBytes.length; i++) {
    encrypted[i] = keyBytes[i] ^ secret[i % secret.length];
  }
  return encrypted;
}

/**
 * XOR-decrypt a key with the server secret.
 */
export function xorDecryptKey(encryptedKey: string): Uint8Array {
  const secret = getServerSecret();
  const encrypted = base64ToUint8Array(encryptedKey);
  const decrypted = new Uint8Array(encrypted.length);
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ secret[i % secret.length];
  }
  return decrypted;
}

/**
 * Encrypt video bytes using AES-256-GCM (browser native Web Crypto API).
 * Returns ciphertext + IV + encrypted key ready for IPFS upload.
 */
export async function encryptVideoClient(
  videoBytes: Uint8Array,
  recordingId: string
): Promise<EncryptResult> {
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

  // Export key for storage
  const rawKey = await crypto.subtle.exportKey("raw", key);
  const keyBytes = new Uint8Array(rawKey.slice(0));

  // Create key hash for verification (SHA-256)
  const keyHashBuf = await crypto.subtle.digest("SHA-256", keyBytes.buffer);
  const keyHashArray = new Uint8Array(keyHashBuf);
  const keyHash = Array.from(keyHashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // XOR-encrypt the key with server secret
  const secret = getServerSecret();
  const encryptedKeyBytes = xorEncryptKey(keyBytes, secret);
  const encryptedKey = uint8ArrayToBase64(encryptedKeyBytes);

  // Encode ciphertext as base64
  const ciphertext = arrayBufferToBase64(encrypted);

  return {
    ciphertext,
    iv: uint8ArrayToBase64(iv),
    keyHash,
    encryptedKey,
  };
}

/**
 * Decrypt video bytes client-side using the XOR-decrypted key.
 */
export async function decryptVideoClientSide(
  ciphertext: string,
  iv: string,
  encryptedKey: string
): Promise<Uint8Array> {
  // Decrypt the key with server secret
  const keyBytes = xorDecryptKey(encryptedKey);

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

// Helper functions

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