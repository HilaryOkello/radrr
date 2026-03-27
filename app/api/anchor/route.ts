import { NextRequest, NextResponse } from "next/server";
import { anchorRecording } from "@/lib/filecoin";
import { storeRecordingMetadata } from "@/lib/synapse";
import { mintSaleHypercert } from "@/lib/hypercerts";

function getPlatformAddress(): string {
  const { privateKeyToAccount } = require("viem/accounts");
  return privateKeyToAccount(
    (process.env.EVM_PLATFORM_PRIVATE_KEY ?? "") as `0x${string}`
  ).address;
}

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

    const walletAddress = witness ?? getPlatformAddress();

    if (visibilityLevel === "full") {
      mintSaleHypercert({
        recordingId,
        witnessAddress: walletAddress,
        witnessCredibilityScore: 50,
        eventDescription: title ?? "Untitled Recording",
        gpsApprox: gpsApprox ?? "unknown",
        recordingTimestamp: Date.now() / 1000,
        isCorroborated: false,
        isPublicShare: true,
      }).catch((err) => console.error("[hypercert mint on publish failed]", err));
    }

    // Store recording metadata on Filecoin via Synapse SDK (fire and forget)
    storeRecordingMetadata({
      recordingId,
      merkleRoot,
      gpsApprox: gpsApprox ?? "unknown",
      witness: walletAddress,
      timestamp: Date.now(),
      txHash: String(txHash),
    }).catch(() => {});

    return NextResponse.json({ txHash, recordingId, walletAddress });
  } catch (err) {
    console.error("[anchor]", err);
    return NextResponse.json(
      { error: "Failed to anchor recording on Filecoin" },
      { status: 500 }
    );
  }
}
