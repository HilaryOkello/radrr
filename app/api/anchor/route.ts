import { NextRequest, NextResponse } from "next/server";
import { anchorRecording } from "@/lib/worldchain";

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

    return NextResponse.json({ txHash, recordingId });
  } catch (err) {
    console.error("[anchor]", err);
    return NextResponse.json(
      { error: "Failed to anchor recording on World Chain" },
      { status: 500 }
    );
  }
}
