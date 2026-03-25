import { NextRequest, NextResponse } from "next/server";
import { updateEncryptedCid } from "@/lib/filecoin";

/**
 * Encryption happens client-side (browser → Lit nodes directly).
 * This route only records the encrypted CID on-chain.
 */
export async function POST(req: NextRequest) {
  try {
    const { recordingId, encryptedCid } = await req.json();

    if (!recordingId || !encryptedCid) {
      return NextResponse.json(
        { error: "recordingId and encryptedCid are required" },
        { status: 400 }
      );
    }

    await updateEncryptedCid(recordingId, encryptedCid);
    return NextResponse.json({ encryptedCid, recordingId });
  } catch (err) {
    console.error("[encrypt]", err);
    return NextResponse.json(
      { error: "Failed to update encrypted CID on-chain" },
      { status: 500 }
    );
  }
}
