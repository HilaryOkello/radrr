import { NextRequest, NextResponse } from "next/server";
import { anchorRecording } from "@/lib/near";

export async function POST(req: NextRequest) {
  try {
    const { recordingId, merkleRoot, gpsApprox, title, priceNear } =
      await req.json();

    if (!recordingId || !merkleRoot) {
      return NextResponse.json(
        { error: "recordingId and merkleRoot are required" },
        { status: 400 }
      );
    }

    const nearTxHash = await anchorRecording({
      recordingId,
      merkleRoot,
      gpsApprox: gpsApprox ?? "unknown",
      title: title ?? "Untitled Recording",
      priceNear: priceNear ?? "1.0",
    });

    return NextResponse.json({ nearTxHash, recordingId });
  } catch (err) {
    console.error("[anchor]", err);
    return NextResponse.json(
      { error: "Failed to anchor recording on NEAR" },
      { status: 500 }
    );
  }
}
