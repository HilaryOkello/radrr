import { NextRequest, NextResponse } from "next/server";
import { getIdentity } from "@/lib/filecoin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const account = searchParams.get("account");

  if (!account) {
    return NextResponse.json({ error: "account required" }, { status: 400 });
  }

  try {
    const identity = await getIdentity(account);
    return NextResponse.json({ identity });
  } catch (err) {
    console.error("[identity]", err);
    return NextResponse.json({ identity: null });
  }
}
