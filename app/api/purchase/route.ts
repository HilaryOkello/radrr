import { NextRequest, NextResponse } from "next/server";
import { isPurchased, getRecordings } from "@/lib/filecoin";
import { mintSaleHypercert } from "@/lib/hypercerts";

/**
 * Purchase confirmation endpoint.
 *
 * Flow:
 * 1. Buyer has already sent the Filecoin payment transaction client-side.
 * 2. This endpoint verifies the purchase is recorded on-chain.
 * 3. Returns the encrypted CID + dataToEncryptHash for client-side Lit decryption.
 * 4. Mints a Hypercert recording the sale.
 *
 * Note: Actual Lit decryption happens client-side (buyer's wallet signs the session).
 */
export async function POST(req: NextRequest) {
  try {
    const { recordingId, buyerAddress } = await req.json();

    if (!recordingId || !buyerAddress) {
      return NextResponse.json(
        { error: "recordingId and buyerAddress are required" },
        { status: 400 }
      );
    }

    // Verify purchase is on-chain
    const purchased = await isPurchased(recordingId, buyerAddress);
    if (!purchased) {
      return NextResponse.json(
        { error: "Purchase not found on-chain. Submit Filecoin payment first." },
        { status: 402 }
      );
    }

    // Get recording details for Hypercert
    const recordings = (await getRecordings(0, 50)) as Array<{
      recording_id: string;
      encrypted_cid?: string;
      witness: string;
      gps_approx: string;
      timestamp: number;
      title: string;
      corroboration_bundle: string[];
    }>;

    const recording = recordings.find((r) => r.recording_id === recordingId);
    if (!recording) {
      return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    }

    // Mint Hypercert for this sale (fire and forget — don't block buyer)
    mintSaleHypercert({
      recordingId,
      witnessAddress: recording.witness,
      witnessCredibilityScore: 50, // would come from identity in production
      eventDescription: recording.title,
      gpsApprox: recording.gps_approx,
      recordingTimestamp: recording.timestamp,
      isCorroborated: recording.corroboration_bundle.length > 0,
    }).catch((err) => console.error("[hypercert mint failed]", err));

    // Return the encrypted CID for client-side Lit decryption
    return NextResponse.json({
      success: true,
      encryptedCid: recording.encrypted_cid,
      recordingId,
      // Client uses these to call Lit decryptToString()
      litAccessNote:
        "Use encryptedCid to fetch ciphertext + dataToEncryptHash from Storacha, then call Lit Protocol decryptToString() with your wallet session.",
    });
  } catch (err) {
    console.error("[purchase]", err);
    return NextResponse.json(
      { error: "Purchase verification failed" },
      { status: 500 }
    );
  }
}
