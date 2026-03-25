/**
 * SigLIP 2 embedding extraction and corroboration matching.
 *
 * Uses HuggingFace Inference API to generate SigLIP 2 embeddings for keyframes.
 * In production: replace with NEAR AI inference endpoint.
 *
 * Corroboration logic:
 * 1. Extract keyframes from video (via canvas/frame grab)
 * 2. Get SigLIP embeddings for each keyframe
 * 3. Compare embeddings across GPS-filtered recordings
 * 4. If cosine similarity > 0.85 → bundle as corroborated
 */

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
const SIGLIP_MODEL = "google/siglip-base-patch16-224";
const SIMILARITY_THRESHOLD = 0.85;

// In-memory embedding index for hackathon demo.
// Key: recordingId, Value: { embeddings: number[][], gpsApprox: string }
const embeddingIndex = new Map<
  string,
  { embeddings: number[][]; gpsApprox: string; witness: string }
>();

/**
 * Get SigLIP 2 image embeddings from HuggingFace Inference API.
 */
async function getSigLIPEmbedding(imageBase64: string): Promise<number[]> {
  if (!HF_API_KEY) {
    // Return mock embedding for local dev
    return Array.from({ length: 768 }, () => Math.random() * 2 - 1);
  }

  const response = await fetch(
    `https://api-inference.huggingface.co/models/${SIGLIP_MODEL}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: { image: imageBase64 },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`HuggingFace API error: ${response.status}`);
  }

  const data = await response.json();
  // HF feature extraction returns the embedding array
  return Array.isArray(data) ? data[0] : data.embeddings?.[0] ?? [];
}

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

/**
 * Add a recording to the embedding index.
 * Keyframes should be base64-encoded JPEG/PNG images.
 */
export async function indexRecording(params: {
  recordingId: string;
  keyframes: string[]; // base64 images
  gpsApprox: string;
  witness: string;
}): Promise<void> {
  const embeddings = await Promise.all(
    params.keyframes.map((kf) => getSigLIPEmbedding(kf))
  );
  embeddingIndex.set(params.recordingId, {
    embeddings,
    gpsApprox: params.gpsApprox,
    witness: params.witness,
  });
}

/**
 * Find corroborating recordings for a given recording.
 * Filters by GPS cluster (1-degree precision = ~111km) then compares embeddings.
 */
export async function findCorroborations(params: {
  recordingId: string;
  embeddings: number[][];
  gpsApprox: string;
}): Promise<Array<{ recordingId: string; similarity: number }>> {
  const matches: Array<{ recordingId: string; similarity: number }> = [];

  // Parse GPS for cluster filtering
  const [lat, lng] = params.gpsApprox.split(",").map(Number);
  const gpsCluster = `${Math.round(lat)},${Math.round(lng)}`; // 1-degree cluster

  for (const [candidateId, candidate] of embeddingIndex.entries()) {
    if (candidateId === params.recordingId) continue;

    // GPS cluster filter
    const [cLat, cLng] = candidate.gpsApprox.split(",").map(Number);
    const candidateCluster = `${Math.round(cLat)},${Math.round(cLng)}`;
    if (candidateCluster !== gpsCluster) continue;

    // Compare embeddings (max similarity across all keyframe pairs)
    let maxSimilarity = 0;
    for (const queryEmb of params.embeddings) {
      for (const candidateEmb of candidate.embeddings) {
        const sim = cosineSimilarity(queryEmb, candidateEmb);
        if (sim > maxSimilarity) maxSimilarity = sim;
      }
    }

    if (maxSimilarity >= SIMILARITY_THRESHOLD) {
      matches.push({ recordingId: candidateId, similarity: maxSimilarity });
    }
  }

  return matches.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Full corroboration pipeline for a recording.
 * Returns matched recording IDs.
 */
export async function runCorroboration(params: {
  recordingId: string;
  keyframes: string[];
  gpsApprox: string;
  witness: string;
}): Promise<string[]> {
  // Index this recording
  await indexRecording(params);

  // Get embeddings for this recording from index
  const entry = embeddingIndex.get(params.recordingId);
  if (!entry) return [];

  const matches = await findCorroborations({
    recordingId: params.recordingId,
    embeddings: entry.embeddings,
    gpsApprox: params.gpsApprox,
  });

  return matches.map((m) => m.recordingId);
}
