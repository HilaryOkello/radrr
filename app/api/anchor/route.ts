import { NextRequest, NextResponse } from "next/server";
import { anchorRecording } from "@/lib/filecoin";
import { storeRecordingMetadata } from "@/lib/synapse";

export async function POST(req: NextRequest) {
  try {
    const { 
      recordingId, 
      merkleRoot, 
      gpsApprox, 
      title, 
      description, 
      previewCid, 
      trailerCid,
      visibilityLevel,
      licenseType,
      priceEth, 
      witness 
    } = await req.json();

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
      description: description ?? "",
      previewCid: previewCid ?? "",
      trailerCid: trailerCid ?? "",
      visibilityLevel: visibilityLevel ?? "blur",
      licenseType: licenseType ?? "non_exclusive",
      priceEth: priceEth ?? "0.001",
      witness: witness ?? undefined,
    });

    // Store recording metadata on Filecoin via Synapse SDK (fire and forget)
    storeRecordingMetadata({
      recordingId,
      merkleRoot,
      gpsApprox: gpsApprox ?? "unknown",
      witness: witness ?? "platform",
      timestamp: Date.now(),
      txHash: String(txHash),
    }).catch(() => {});

    // Return the effective witness address for localStorage identity
    const walletAddress = witness ?? (() => {
      const { privateKeyToAccount } = require("viem/accounts");
      return privateKeyToAccount(
        (process.env.EVM_PLATFORM_PRIVATE_KEY ?? "") as `0x${string}`
      ).address;
    })();

    return NextResponse.json({ txHash, recordingId, walletAddress });
  } catch (err) {
    console.error("[anchor]", err);
    return NextResponse.json(
      { error: "Failed to anchor recording on Filecoin" },
      { status: 500 }
    );
  }
}
