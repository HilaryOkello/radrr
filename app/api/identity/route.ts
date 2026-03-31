import { NextRequest, NextResponse } from "next/server";
import { getIdentity } from "@/lib/filecoin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const account = searchParams.get("accountId") ?? searchParams.get("account");

  if (!account) {
    return NextResponse.json({ error: "account required" }, { status: 400 });
  }

  try {
    const raw = await getIdentity(account) as { pseudonym: string; credibilityScore: bigint; recordingCount: bigint; totalSales: bigint };
    const identity = {
      pseudonym: raw.pseudonym,
      credibility_score: Number(raw.credibilityScore),
      recording_count: Number(raw.recordingCount),
      total_sales: Number(raw.totalSales),
    };
    return NextResponse.json({ identity });
  } catch (err) {
    console.error("[identity]", err);
    return NextResponse.json({ identity: null });
  }
}
