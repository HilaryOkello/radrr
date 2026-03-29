import { NextRequest, NextResponse } from "next/server";
import { AtpAgent } from "@atproto/api";

const PDS_URL = process.env.CERTIFIED_APP_PDS ?? "https://certified.one";

export interface HypercertEntry {
  tokenId: string;       // AT-URI of the record
  uri: string;           // AT-URI
  name: string;
  description: string;
  image: string;
  contributor: string;   // witness EVM address
  recordingId: string | null;
  verificationLevel: string | null;
  isCorroborated: boolean | null;
  isPublicShare: boolean | null;
  totalUnits: string;
  platform: string | null;
  createdAt: number;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    // Accept DID only if it looks like a real resolved DID (not placeholder)
    const rawDid = process.env.CERTIFIED_APP_DID ?? "";
    const platformDid = rawDid.startsWith("did:plc:") && rawDid.length > 12 ? rawDid : null;

    const repo = platformDid ?? await resolveDid(process.env.CERTIFIED_APP_HANDLE ?? "");
    if (!repo) {
      return NextResponse.json({ hypercerts: [] });
    }

    // Read records from the PDS — public, no auth needed
    const agent = new AtpAgent({ service: PDS_URL });

    let cursor: string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allRecords: any[] = [];

    do {
      const res = await agent.com.atproto.repo.listRecords({
        repo,
        collection: "org.hypercerts.claim.activity",
        limit: 100,
        cursor,
      });
      allRecords.push(...res.data.records);
      cursor = res.data.cursor;
    } while (cursor);

    const addressLower = address.toLowerCase();

    const hypercerts: HypercertEntry[] = allRecords
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((r: any) => {
        const rec = r.value;
        // Match by witnessAddress field or contributors identity
        if (typeof rec.witnessAddress === "string") {
          return rec.witnessAddress.toLowerCase() === addressLower;
        }
        if (Array.isArray(rec.contributors)) {
          return rec.contributors.some(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (c: any) => c?.contributorIdentity?.identity?.toLowerCase() === addressLower
          );
        }
        return false;
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => {
        const rec = r.value;
        const createdAt = rec.createdAt ? new Date(rec.createdAt).getTime() : 0;
        return {
          tokenId: r.uri,
          uri: r.uri,
          name: rec.title ?? "Untitled Hypercert",
          description: rec.description ?? "",
          image: "",
          contributor: rec.witnessAddress ?? address,
          recordingId: rec.recordingId ?? null,
          verificationLevel: rec.verificationLevel ?? null,
          isCorroborated: rec.isCorroborated ?? null,
          isPublicShare: rec.isPublicShare ?? null,
          totalUnits: "1",
          platform: rec.platform ?? "radrr",
          createdAt,
        } satisfies HypercertEntry;
      });

    hypercerts.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json({ hypercerts });
  } catch (err) {
    console.error("[hypercerts/by-owner]", err);
    return NextResponse.json({ hypercerts: [] });
  }
}

async function resolveDid(handle: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${PDS_URL}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.did ?? null;
  } catch {
    return null;
  }
}
