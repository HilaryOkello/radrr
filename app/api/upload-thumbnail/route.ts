import { NextRequest, NextResponse } from "next/server";
import { uploadVideo } from "@/lib/storacha";

/**
 * Upload a thumbnail or trailer to Storacha WITHOUT linking the CID on-chain.
 * Used for preview images and short clip previews.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const cid = await uploadVideo(buffer, file.name);

    return NextResponse.json({ cid });
  } catch (err) {
    console.error("[upload-thumbnail]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
