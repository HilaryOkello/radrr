import { NextRequest, NextResponse } from "next/server";
import { getRecordingsByWitness, getRecordings } from "@/lib/near";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const witness = searchParams.get("witness");
  const from = Number(searchParams.get("from") ?? 0);
  const limit = Number(searchParams.get("limit") ?? 20);

  try {
    const recordings = witness
      ? await getRecordingsByWitness(witness)
      : await getRecordings(from, limit);

    return NextResponse.json({ recordings });
  } catch (err) {
    console.error("[recordings]", err);
    return NextResponse.json({ recordings: [] });
  }
}
