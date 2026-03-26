import { NextRequest, NextResponse } from "next/server";
import { rejectBid } from "@/lib/filecoin";

export async function POST(req: NextRequest) {
  try {
    const { recordingId, bidIndex, witness } = await req.json();
    if (!recordingId || bidIndex === undefined || !witness) {
      return NextResponse.json({ error: "recordingId, bidIndex, witness required" }, { status: 400 });
    }

    const txHash = await rejectBid(recordingId, Number(bidIndex), witness);
    return NextResponse.json({ txHash, recordingId, bidIndex });
  } catch (err) {
    console.error("[bids/reject]", err);
    return NextResponse.json({ error: "Failed to reject bid" }, { status: 500 });
  }
}
