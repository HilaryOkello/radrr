import { NextRequest, NextResponse } from "next/server";
import { AtpAgent } from "@atproto/api";

const PDS_URL = process.env.CERTIFIED_APP_PDS ?? "https://certified.one";

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

async function getAgent(): Promise<AtpAgent> {
  const handle = process.env.CERTIFIED_APP_HANDLE;
  const password = process.env.CERTIFIED_APP_PASSWORD;
  if (!handle || !password) {
    throw new Error("CERTIFIED_APP_HANDLE and CERTIFIED_APP_PASSWORD must be set");
  }
  const agent = new AtpAgent({ service: PDS_URL });
  await agent.login({ identifier: handle, password });
  return agent;
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

    // Fetch hypercerts from AT Protocol PDS
    const agent = await getAgent();
    const did = agent.session?.did;
    
    if (!did) {
      console.error("[hypercerts/by-owner] Not authenticated");
      return NextResponse.json({ hypercerts: [] });
    }

    // Query records from the PDS
    const response = await agent.com.atproto.repo.listRecords({
      repo: did,
      collection: "org.hypercerts.claim.activity",
      limit: 100,
    });

    const records = response.data.records ?? [];

    // Filter by the requested address (check if witnessAddress matches)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hypercerts: HypercertEntry[] = records.map((record: any) => {
      const value = record.value;
      const desc = value.description ?? "";
      
      // Parse Radrr-specific fields from description
      const recordingIdMatch = desc.match(/Recording ID: ([^\n]+)/);
      const corroboratedMatch = desc.match(/Corroborated: (true|false)/);
      
      // Check if this hypercert belongs to the requested address
      const contributors = value.contributors ?? [];
      const isMintedByUser = contributors.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any) => c.contributorIdentity?.identity?.toLowerCase() === address.toLowerCase()
      );
      
      const createdAt = value.createdAt 
        ? new Date(value.createdAt).getTime()
        : 0;

      return {
        tokenId: record.uri.split("/").pop() ?? "",
        uri: record.uri,
        name: value.title ?? "Radrr Hypercert",
        description: desc,
        image: "",
        contributor: address,
        recordingId: recordingIdMatch ? recordingIdMatch[1].trim() : null,
        verificationLevel: value.verificationLevel ?? null,
        isCorroborated: corroboratedMatch ? corroboratedMatch[1] === "true" : null,
        isPublicShare: desc.includes("freely shared") || desc.includes("public documentation"),
        totalUnits: "1",
        platform: value.platform ?? "radrr",
        createdAt,
      } satisfies HypercertEntry;
    }).filter((h: HypercertEntry) => {
      // For minted hypercerts, check if the contributor matches
      return h.contributor.toLowerCase() === address.toLowerCase();
    });

    hypercerts.sort((a, b) => b.createdAt - a.createdAt);
    return NextResponse.json({ hypercerts });
  } catch (err) {
    console.error("[hypercerts/by-owner]", err);
    return NextResponse.json({ hypercerts: [] });
  }
}
