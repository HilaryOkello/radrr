import { NextRequest, NextResponse } from "next/server";
import { getBids, placeBid } from "@/lib/filecoin";
import { parseEther } from "viem";

function serializeBid(bid: { bidder: string; amount: bigint; timestamp: bigint; status: number }, index: number) {
  const statusMap = ["Pending", "Accepted", "Rejected", "Withdrawn"] as const;
  return {
    index,
    bidder: bid.bidder,
    amount: String(bid.amount),
    timestamp: Number(bid.timestamp),
    status: statusMap[bid.status] ?? "Unknown",
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const recordingId = searchParams.get("recordingId");
  if (!recordingId) {
    return NextResponse.json({ error: "recordingId is required" }, { status: 400 });
  }

  try {
    const raw = await getBids(recordingId) as Array<{ bidder: string; amount: bigint; timestamp: bigint; status: number }>;
    const bids = Array.from(raw).map((b, i) => serializeBid(b, i));
    return NextResponse.json({ bids });
  } catch (err) {
    console.error("[bids GET]", err);
    return NextResponse.json({ bids: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { recordingId, bidder, amountEth } = await req.json();
    if (!recordingId || !bidder || !amountEth) {
      return NextResponse.json({ error: "recordingId, bidder, amountEth required" }, { status: 400 });
    }

    const amountWei = parseEther(String(amountEth));
    const txHash = await placeBid(recordingId, bidder, amountWei);

    return NextResponse.json({ txHash, recordingId, bidder });
  } catch (err) {
    console.error("[bids POST]", err);
    return NextResponse.json({ error: "Failed to place bid" }, { status: 500 });
  }
}
