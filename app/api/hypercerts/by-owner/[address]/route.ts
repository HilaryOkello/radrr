import { NextRequest, NextResponse } from "next/server";

const USE_TESTNET = process.env.HYPERCERTS_TESTNET !== "false";
const GRAPH_URL = USE_TESTNET
  ? "https://api.hypercerts.org/v1/graphql"
  : "https://api.hypercerts.org/v1/graphql";

export interface HypercertEntry {
  tokenId: string;
  uri: string;
  name: string;
  description: string;
  image: string;
  contributor: string;
  recordingId: string | null;
  verificationLevel: string | null;
  isCorroborated: boolean | null;
  isPublicShare: boolean | null;
  totalUnits: string;
  platform: string | null;
  createdAt: number;
}

const QUERY = `
  query HypercertsByContributor($address: String!) {
    hypercerts(
      where: {
        hypercert_id: { contains: "" }
        contributors: { contributor_address: { eq: $address } }
      }
      first: 100
    ) {
      data {
        hypercert_id
        uri
        units
        metadata {
          name
          description
          external_url
          work_timeframe_from
        }
        contract {
          chain_id
        }
      }
    }
  }
`;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    const res = await fetch(GRAPH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: QUERY,
        variables: { address: address.toLowerCase() },
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.error("[hypercerts/by-owner] indexer error", res.status);
      return NextResponse.json({ hypercerts: [] });
    }

    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[] = json?.data?.hypercerts?.data ?? [];

    const hypercerts: HypercertEntry[] = raw.map((h) => {
      const meta = h.metadata ?? {};
      const createdAt = meta.work_timeframe_from
        ? Number(meta.work_timeframe_from) * 1000
        : 0;

      // Parse Radrr-specific fields from description if present
      const desc: string = meta.description ?? "";
      const recordingIdMatch = desc.match(/Recording ID: ([^\n]+)/);
      const corroboratedMatch = desc.match(/Corroborated: (true|false)/);

      return {
        tokenId: h.hypercert_id ?? h.uri ?? "",
        uri: h.uri ?? "",
        name: meta.name ?? "Radrr Hypercert",
        description: desc,
        image: meta.image ?? "",
        contributor: address,
        recordingId: recordingIdMatch ? recordingIdMatch[1].trim() : null,
        verificationLevel: null,
        isCorroborated: corroboratedMatch ? corroboratedMatch[1] === "true" : null,
        isPublicShare: desc.includes("public documentation") ? true
          : desc.includes("verified purchase") ? false
          : null,
        totalUnits: String(h.units ?? 1),
        platform: "radrr",
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
