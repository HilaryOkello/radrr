import { NextRequest, NextResponse } from "next/server";
import { signRequest } from "@worldcoin/idkit-core";

/**
 * Generates a signed RP context for World ID v4.
 * The signing_key comes from the Developer Portal and must never be exposed client-side.
 */
export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();
    const signingKey = process.env.WORLDID_SIGNING_KEY;

    if (!signingKey) {
      return NextResponse.json(
        { error: "WORLDID_SIGNING_KEY not configured" },
        { status: 500 }
      );
    }

    const { sig, nonce, createdAt, expiresAt } = signRequest(
      action ?? process.env.WORLDID_ACTION_ID ?? "radrr-witness-verify",
      signingKey
    );

    return NextResponse.json({
      sig,
      nonce,
      created_at: createdAt,
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error("[rp-signature]", err);
    return NextResponse.json(
      { error: "Failed to generate RP signature" },
      { status: 500 }
    );
  }
}
