import { NextRequest, NextResponse } from "next/server";
import { uploadVideo } from "@/lib/storacha";
import { updateCid } from "@/lib/filecoin";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const videoFile = formData.get("video") as File | null;
    const recordingId = formData.get("recordingId") as string | null;

    if (!videoFile || !recordingId) {
      return NextResponse.json(
        { error: "video file and recordingId are required" },
        { status: 400 }
      );
    }

    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    const cid = await uploadVideo(videoBuffer, `${recordingId}.webm`);

    // Link CID to on-chain recording
    await updateCid(recordingId, cid);

    return NextResponse.json({ cid, recordingId });
  } catch (err) {
    console.error("[upload]", err);
    return NextResponse.json(
      { error: "Failed to upload to Filecoin" },
      { status: 500 }
    );
  }
}
