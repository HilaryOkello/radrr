import { NextRequest, NextResponse } from "next/server";
import { runCorroboration } from "@/lib/siglip";
import { updateCorroboration, incrementCredibility } from "@/lib/filecoin";

/**
 * Corroboration endpoint.
 * Accepts keyframes (base64) + GPS, finds matching recordings, bundles them.
 */
export async function POST(req: NextRequest) {
  try {
    const { recordingId, keyframes, gpsApprox, witness } = await req.json() as {
      recordingId: string;
      keyframes: string[];
      gpsApprox: string;
      witness: string;
    };

    if (!recordingId || !keyframes?.length || !gpsApprox) {
      return NextResponse.json(
        { error: "recordingId, keyframes, and gpsApprox are required" },
        { status: 400 }
      );
    }

    // Run corroboration: SigLIP embeddings + cosine similarity
    const matchedIds = await runCorroboration({
      recordingId,
      keyframes,
      gpsApprox,
      witness: witness ?? "unknown",
    });

    if (matchedIds.length > 0) {
      // Update corroboration bundle on NEAR
      const bundle = [recordingId, ...matchedIds];
      for (const id of bundle) {
        await updateCorroboration(id, bundle.filter((b) => b !== id));
      }

      // Boost credibility for all witnesses in the bundle
      // (In production, we'd look up each recording's witness address)
      await incrementCredibility(witness, matchedIds.length * 10);
    }

    return NextResponse.json({
      recordingId,
      matchedIds,
      corroborated: matchedIds.length > 0,
      credibilityBoost: matchedIds.length * 10,
    });
  } catch (err) {
    console.error("[corroborate]", err);
    return NextResponse.json(
      { error: "Corroboration failed" },
      { status: 500 }
    );
  }
}
