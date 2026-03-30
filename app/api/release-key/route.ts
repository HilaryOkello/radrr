import { NextRequest, NextResponse } from "next/server";
import { releaseEncryptionKey } from "@/lib/encryption";
import { isPurchased } from "@/lib/filecoin";

/**
 * Release encryption key to verified buyer.
 * 
 * Verifies on-chain purchase before releasing the AES-256-GCM key.
 * This replaces Lit Protocol with server-side key escrow.
 */
export async function POST(req: NextRequest) {
  try {
    const { recordingId, buyerAddress, keyCid } = await req.json();

    if (!recordingId || !buyerAddress || !keyCid) {
      return NextResponse.json(
        { error: "recordingId, buyerAddress, and keyCid are required" },
        { status: 400 }
      );
    }

    // Verify purchase on-chain (double-check)
    const purchased = await isPurchased(recordingId, buyerAddress);
    if (!purchased) {
      return NextResponse.json(
        { error: "Purchase not verified on-chain" },
        { status: 403 }
      );
    }

    // Release the encryption key (fetches from IPFS)
    const key = await releaseEncryptionKey(keyCid, buyerAddress, recordingId);

    return NextResponse.json({
      success: true,
      key,
      recordingId,
    });
  } catch (err) {
    console.error("[/api/release-key]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to release key" },
      { status: 500 }
    );
  }
}