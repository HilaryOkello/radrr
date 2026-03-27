import { NextRequest, NextResponse } from "next/server";
import { getBidsByBidder } from "@/lib/filecoin";

function serializeBid(bid: { recordingId: string; title: string; bidIndex: number; amount: bigint; timestamp: bigint; status: number }) {
  const statusMap = ["Pending", "Accepted", "Rejected", "Withdrawn"] as const;
  return {
    index: bid.bidIndex,
    recording_id: bid.recordingId,
    title: bid.title,
    amount: String(bid.amount),
    timestamp: Number(bid.timestamp),
    status: statusMap[bid.status] ?? "Unknown",
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bidder = searchParams.get("bidder");
  
  if (!bidder) {
    return NextResponse.json({ error: "bidder is required" }, { status: 400 });
  }

  try {
    const raw = await getBidsByBidder(bidder);
    const bids = Array.from(raw).map(serializeBid);
    return NextResponse.json({ bids });
  } catch (err) {
    console.error("[bids by bidder GET]", err);
    return NextResponse.json({ bids: [] });
  }
}
