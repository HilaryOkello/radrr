import { NextRequest, NextResponse } from "next/server";
import { anchorRecording } from "@/lib/filecoin";
import { storeRecordingMetadata } from "@/lib/synapse";

export async function POST(req: NextRequest) {
  try {
    const { recordingId, merkleRoot, gpsApprox, title, priceEth } =
      await req.json();

    if (!recordingId || !merkleRoot) {
      return NextResponse.json(
        { error: "recordingId and merkleRoot are required" },
        { status: 400 }
      );
    }

    const txHash = await anchorRecording({
      recordingId,
      merkleRoot,
      gpsApprox: gpsApprox ?? "unknown",
      title: title ?? "Untitled Recording",
      priceEth: priceEth ?? "0.001",
    });

    // Store recording metadata on Filecoin via Synapse SDK (fire and forget)
    storeRecordingMetadata({
      recordingId,
      merkleRoot,
      gpsApprox: gpsApprox ?? "unknown",
      witness:   "platform",
      timestamp: Date.now(),
      txHash:    String(txHash),
    }).catch(() => {});

    const { privateKeyToAccount } = await import("viem/accounts");
    const walletAddress = privateKeyToAccount(
      (process.env.EVM_PLATFORM_PRIVATE_KEY ?? "") as `0x${string}`
    ).address;

    return NextResponse.json({ txHash, recordingId, walletAddress });
  } catch (err) {
    console.error("[anchor]", err);
    return NextResponse.json(
      { error: "Failed to anchor recording on Filecoin" },
      { status: 500 }
    );
  }
}
