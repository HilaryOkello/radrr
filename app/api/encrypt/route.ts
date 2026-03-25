import { NextRequest, NextResponse } from "next/server";
import { encryptVideo } from "@/lib/lit";
import { uploadEncryptedVideo } from "@/lib/storacha";
import { updateEncryptedCid } from "@/lib/filecoin";

export async function POST(req: NextRequest) {
  try {
    const { recordingId, cid } = await req.json();

    if (!recordingId || !cid) {
      return NextResponse.json(
        { error: "recordingId and cid are required" },
        { status: 400 }
      );
    }

    // Fetch the raw video from Storacha/IPFS gateway
    const gatewayUrl = `https://${cid}.ipfs.w3s.link`;
    const videoRes = await fetch(gatewayUrl);
    if (!videoRes.ok) {
      throw new Error(`Failed to fetch video from gateway: ${videoRes.status}`);
    }
    const videoBytes = new Uint8Array(await videoRes.arrayBuffer());

    // Encrypt with Lit Protocol
    const { ciphertext, dataToEncryptHash } = await encryptVideo(
      videoBytes,
      recordingId
    );

    // Store the encryption metadata on Storacha
    const encryptionMeta = JSON.stringify({ ciphertext, dataToEncryptHash, recordingId });
    const encryptedCid = await uploadEncryptedVideo(
      Buffer.from(encryptionMeta),
      recordingId
    );

    // Link encrypted CID on Filecoin FVM
    await updateEncryptedCid(recordingId, encryptedCid);

    return NextResponse.json({ encryptedCid, recordingId });
  } catch (err) {
    console.error("[encrypt]", err);
    return NextResponse.json(
      { error: "Failed to encrypt footage" },
      { status: 500 }
    );
  }
}
