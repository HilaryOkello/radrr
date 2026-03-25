/**
 * World ID server-side proof verification.
 * https://docs.world.org/world-id/idkit/integrate
 */

export interface WorldIDProof {
  merkle_root: string;
  nullifier_hash: string;
  proof: string;
  verification_level: string;
}

export async function verifyWorldIDProof(params: {
  proof: WorldIDProof;
  action: string;
  signal?: string;
}): Promise<{ success: boolean; nullifier_hash: string }> {
  const appId = process.env.WORLDCOIN_APP_ID;
  if (!appId) throw new Error("WORLDCOIN_APP_ID env var not set");

  const response = await fetch(
    `https://developer.worldcoin.org/api/v1/verify/${appId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nullifier_hash: params.proof.nullifier_hash,
        merkle_root: params.proof.merkle_root,
        proof: params.proof.proof,
        verification_level: params.proof.verification_level,
        action: params.action,
        signal: params.signal ?? "",
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`World ID verification failed: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return {
    success: true,
    nullifier_hash: params.proof.nullifier_hash,
  };
}
