import { NextRequest, NextResponse } from "next/server";
import { isPurchased, getRecording, recordAgentTaskSuccess } from "@/lib/filecoin";
import { mintSaleHypercert } from "@/lib/hypercerts";

const AGENT_ADDRESS = "0x3B5FA5297f158cBB1c375372594858BB3B150463";

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
    const recording = await getRecording(recordingId);
    if (!recording || !recording.recordingId) {
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
        gpsApprox: recording.gpsApprox,
        recordingTimestamp: Number(recording.timestamp),
        isCorroborated: recording.corroborationBundle?.length > 0,
      });
      hypercertTokenId = txHash ?? null;
    } catch (err) {
      console.error("[hypercert mint failed]", err);
    }

    // Wire purchase to ERC-8004 agent reputation
    try {
      await recordAgentTaskSuccess(AGENT_ADDRESS, `purchase verified: ${recordingId}`);
    } catch {
      // best-effort — don't fail the purchase if reputation update fails
    }

    return NextResponse.json({
      success: true,
      alreadyPurchased: true, // True if purchased via bid acceptance or direct purchase
      encryptedCid: recording.encryptedCid,
      keyCid: recording.keyCid,
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
