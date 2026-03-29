import { NextRequest, NextResponse } from "next/server";
import { uploadEncryptedVideo } from "@/lib/storacha";
import { updateEncryptedCid } from "@/lib/filecoin";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("video") as File | null;
    const recordingId = form.get("recordingId") as string | null;

    if (!file || !recordingId) {
      return NextResponse.json(
        { error: "video file and recordingId are required" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const cid = await uploadEncryptedVideo(buffer, recordingId);

    await updateEncryptedCid(recordingId, cid);

    return NextResponse.json({ cid, recordingId });
  } catch (err) {
    console.error("[upload-encrypted]", err);
    return NextResponse.json(
      { error: "Failed to upload encrypted file" },
      { status: 500 }
    );
  }
}
