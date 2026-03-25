import { NextRequest, NextResponse } from "next/server";

/**
 * Verifies a World ID v4 proof by forwarding the IDKitResult to the
 * Developer Portal verification endpoint.
 */
export async function POST(req: NextRequest) {
  try {
    const { idkitResponse, accountId, pseudonym } = await req.json();

    if (!idkitResponse || !accountId || !pseudonym) {
      return NextResponse.json(
        { error: "idkitResponse, accountId, and pseudonym are required" },
        { status: 400 }
      );
    }

    const rpId = process.env.WORLDID_RP_ID;
    if (!rpId) {
      return NextResponse.json(
        { error: "WORLDID_RP_ID not configured" },
        { status: 500 }
      );
    }

    // Forward the proof to World ID's verification endpoint (v4)
    const verifyRes = await fetch(
      `https://developer.world.org/api/v4/verify/${rpId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(idkitResponse),
      }
    );

    const payload = await verifyRes.json();

    if (!verifyRes.ok) {
      console.error("[verify-worldid] World ID rejected proof:", payload);
      return NextResponse.json(
        { error: "World ID verification failed", detail: payload },
        { status: 400 }
      );
    }

    // Extract nullifier hash from v4 response
    // v4 returns array of response items; nullifier is in the first item
    const nullifierHash =
      payload.nullifier_hash ??
      payload.response?.[0]?.nullifier_hash ??
      idkitResponse.response?.[0]?.nullifier_hash ??
      "verified";

    return NextResponse.json({
      verified: true,
      nullifier_hash: nullifierHash,
      accountId,
      pseudonym,
    });
  } catch (err) {
    console.error("[verify-worldid]", err);
    return NextResponse.json(
      { error: "World ID verification failed" },
      { status: 400 }
    );
  }
}
