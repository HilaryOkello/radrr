import { NextRequest, NextResponse } from "next/server";
import { uploadVideo } from "@/lib/storacha";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Trailer must be under 5MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const cid = await uploadVideo(buffer, file.name);

    return NextResponse.json({ cid });
  } catch (err) {
    console.error("[upload-trailer]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
