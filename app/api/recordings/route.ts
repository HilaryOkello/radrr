import { NextRequest, NextResponse } from "next/server";
import { getRecordingsByWitness, getRecordings } from "@/lib/filecoin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeRecording(r: any) {
  return {
    recording_id: r.recordingId,
    merkle_root: r.merkleRoot,
    gps_approx: r.gpsApprox,
    timestamp: Number(r.timestamp),
    cid: r.cid,
    encrypted_cid: r.encryptedCid,
    preview_cid: r.previewCid,
    witness: r.witness,
    title: r.title,
    description: r.description,
    price_eth: String(r.priceWei),
    sold: r.sold,
    buyer: r.buyer,
    corroboration_bundle: Array.from(r.corroborationBundle ?? []),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const witness = searchParams.get("witness");
  const from = Number(searchParams.get("from") ?? 0);
  const limit = Number(searchParams.get("limit") ?? 20);

  try {
    const raw = witness
      ? await getRecordingsByWitness(witness)
      : await getRecordings(from, limit);

    const recordings = Array.from(raw).map(serializeRecording);
    return NextResponse.json({ recordings });
  } catch (err) {
    console.error("[recordings]", err);
    return NextResponse.json({ recordings: [] });
  }
}
