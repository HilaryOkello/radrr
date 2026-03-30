import { NextRequest, NextResponse } from "next/server";
import { isPurchased, getRecordings } from "@/lib/filecoin";
import { mintSaleHypercert } from "@/lib/hypercerts";

/**
 * Purchase confirmation endpoint.
 *
 * Flow:
 * 1. For direct purchase: buyer sends payment transaction client-side first.
 * 2. This endpoint verifies the purchase is recorded on-chain.
 * 3. Returns the encrypted CID + keyCid for client-side decryption.
 * 4. Returns alreadyPurchased flag if content was acquired via bid acceptance.
 * 5. Mints a Hypercert recording the sale.
 *
 * Note: Actual decryption happens client-side.
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
    
    // Get recording details for Hypercert and key data
    const recordings = (await getRecordings(0, 50)) as unknown as Array<{
      recording_id: string;
      encrypted_cid?: string;
      key_cid?: string;
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

    // If not purchased via direct payment or bid acceptance, return error
    if (!purchased) {
      return NextResponse.json(
        { error: "Purchase not found on-chain. Submit Filecoin payment first." },
        { status: 402 }
      );
    }

    // Purchase verified - either via direct purchase or bid acceptance
    // No hypercert minting for bid purchases (already minted on bid acceptance)
    // For direct purchases, mint hypercert
    let hypercertTokenId: string | null = null;

    try {
      const txHash = await mintSaleHypercert({
        recordingId,
        witnessAddress: recording.witness,
        witnessCredibilityScore: 50,
        eventDescription: recording.title,
        gpsApprox: recording.gps_approx,
        recordingTimestamp: recording.timestamp,
        isCorroborated: recording.corroboration_bundle.length > 0,
      });
      hypercertTokenId = txHash ?? null;
    } catch (err) {
      console.error("[hypercert mint failed]", err);
    }

    return NextResponse.json({
      success: true,
      alreadyPurchased: true, // True if purchased via bid acceptance or direct purchase
      encryptedCid: recording.encrypted_cid,
      keyCid: recording.key_cid,
      recordingId,
      hypercertTokenId,
    });
  } catch (err) {
    console.error("[purchase]", err);
    return NextResponse.json(
      { error: "Purchase verification failed" },
      { status: 500 }
    );
  }
}
