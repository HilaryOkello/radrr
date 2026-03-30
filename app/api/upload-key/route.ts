import { NextRequest, NextResponse } from "next/server";
import { uploadKeyToIpfs } from "@/lib/encryption-server";

/**
 * Upload encrypted encryption key to IPFS.
 * 
 * Flow:
 * 1. Client encrypts video and XOR-encrypts the key
 * 2. Client sends encrypted key to this endpoint
 * 3. Server uploads to IPFS via Storacha
 * 4. Server returns keyCid
 * 5. Client stores keyCid on-chain
 */
export async function POST(req: NextRequest) {
  try {
    const { recordingId, encryptedKey, keyHash } = await req.json();

    if (!recordingId || !encryptedKey) {
      return NextResponse.json(
        { error: "recordingId and encryptedKey are required" },
        { status: 400 }
      );
    }

    const keyCid = await uploadKeyToIpfs(encryptedKey, keyHash || "", recordingId);

    return NextResponse.json({ keyCid, recordingId });
  } catch (err) {
    console.error("[/api/upload-key]", err);
    return NextResponse.json(
      { error: "Failed to upload encryption key to IPFS" },
      { status: 500 }
    );
  }
}