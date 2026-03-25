/**
 * Web Worker: SHA-256 chunk hashing with chaining + Merkle root computation.
 *
 * Protocol:
 *   IN  { type: 'chunk', chunk: ArrayBuffer }
 *       { type: 'finish' }
 *       { type: 'reset' }
 *
 *   OUT { type: 'chunkHashed', index: number, hash: string }
 *       { type: 'merkleRoot', root: string, hashes: string[] }
 */

let chunkHashes = [];
let prevHash = null; // null means no previous chunk yet

async function sha256(data) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashChunk(chunk) {
  // Chain: hash_n = SHA256(chunk_n || prev_hash_bytes)
  let dataToHash;
  if (prevHash === null) {
    dataToHash = chunk;
  } else {
    // Concatenate chunk bytes with previous hash bytes (hex string as UTF-8)
    const prevHashBytes = new TextEncoder().encode(prevHash);
    const combined = new Uint8Array(chunk.byteLength + prevHashBytes.length);
    combined.set(new Uint8Array(chunk), 0);
    combined.set(prevHashBytes, chunk.byteLength);
    dataToHash = combined.buffer;
  }
  return await sha256(dataToHash);
}

async function computeMerkleRoot(hashes) {
  if (hashes.length === 0) return null;
  if (hashes.length === 1) return hashes[0];

  let level = [...hashes];
  while (level.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left; // duplicate last if odd
      const combined = new TextEncoder().encode(left + right);
      const pairHash = await sha256(combined.buffer);
      nextLevel.push(pairHash);
    }
    level = nextLevel;
  }
  return level[0];
}

self.onmessage = async (event) => {
  const { type, chunk } = event.data;

  if (type === "reset") {
    chunkHashes = [];
    prevHash = null;
    return;
  }

  if (type === "chunk") {
    const hash = await hashChunk(chunk);
    prevHash = hash;
    chunkHashes.push(hash);
    self.postMessage({
      type: "chunkHashed",
      index: chunkHashes.length - 1,
      hash,
    });
    return;
  }

  if (type === "finish") {
    const root = await computeMerkleRoot(chunkHashes);
    self.postMessage({
      type: "merkleRoot",
      root,
      hashes: [...chunkHashes],
    });
    chunkHashes = [];
    prevHash = null;
  }
};
