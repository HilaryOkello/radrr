import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { HypercertMinterAbi } from "@hypercerts-org/contracts";
import { getFromIPFS } from "@hypercerts-org/sdk";

const HYPERCERT_CONTRACT = "0xa16DFb32Eb140a6f3F2AC68f41dAd8c7e83C4941";
const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org";

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

interface Metadata {
  name?: string;
  description?: string;
  image?: string;
  hypercert?: {
    contributors?: { value?: string[] };
  };
  properties?: Array<{ trait_type: string; value: string }>;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const role = req.nextUrl.searchParams.get("role") ?? "owned";

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }

    const client = createPublicClient({
      chain: sepolia,
      transport: http(SEPOLIA_RPC),
    });

    const addressLower = address.toLowerCase();

    if (role === "minted") {
      return await getMintedHypercerts(client, addressLower);
    } else {
      return await getOwnedHypercerts(client, addressLower);
    }
  } catch (err) {
    console.error("[hypercerts/by-owner]", err);
    return NextResponse.json(
      { error: "Failed to fetch hypercerts" },
      { status: 500 }
    );
  }
}

async function getMintedHypercerts(
  client: ReturnType<typeof createPublicClient>,
  address: string
) {
  const logs = await client.getLogs({
    address: HYPERCERT_CONTRACT as `0x${string}`,
    event: {
      type: "event",
      name: "ClaimStored",
      inputs: [
        { indexed: true, name: "claimID", type: "uint256" },
        { indexed: false, name: "uri", type: "string" },
        { indexed: false, name: "totalUnits", type: "uint256" },
      ],
    },
    fromBlock: BigInt(0),
    toBlock: "latest",
  });

  const results: HypercertEntry[] = [];

  for (const log of logs) {
    const args = log.args;
    if (!args) continue;

    const uri = args.uri as string;
    const tokenId = args.claimID as bigint;
    const totalUnits = args.totalUnits as bigint;

    const metadata = await fetchMetadata(uri);
    const contributors = metadata?.hypercert?.contributors?.value ?? [];

    if (!Array.isArray(contributors) || !contributors.map(String).map(s => s.toLowerCase()).includes(address)) {
      continue;
    }

    const properties = metadata?.properties ?? [];
    const prop = (trait: string) => (properties as Array<{ trait_type: string; value: string }>).find(p => p.trait_type === trait)?.value;

    results.push({
      tokenId: String(tokenId),
      uri,
      name: metadata?.name ?? "Untitled Hypercert",
      description: metadata?.description ?? "",
      image: metadata?.image ?? "",
      contributor: String(contributors[0] ?? ""),
      recordingId: prop("recording_id") ?? null,
      verificationLevel: prop("verification_level") ?? null,
      isCorroborated: prop("is_corroborated") === "true",
      isPublicShare: prop("is_public_share") === "true",
      totalUnits: String(totalUnits),
      platform: prop("platform") ?? null,
      createdAt: await blockTimestampFromLog(client, log.blockNumber),
    });
  }

  results.sort((a, b) => b.createdAt - a.createdAt);

  return NextResponse.json({ hypercerts: results });
}

async function getOwnedHypercerts(
  client: ReturnType<typeof createPublicClient>,
  address: string
) {
  const toLogs = await client.getLogs({
    address: HYPERCERT_CONTRACT as `0x${string}`,
    event: {
      type: "event",
      name: "TransferSingle",
      inputs: [
        { indexed: true, name: "operator", type: "address" },
        { indexed: true, name: "from", type: "address" },
        { indexed: true, name: "to", type: "address" },
        { indexed: false, name: "id", type: "uint256" },
        { indexed: false, name: "value", type: "uint256" },
      ],
    },
    fromBlock: BigInt(0),
    toBlock: "latest",
    args: {
      to: address as `0x${string}`,
    },
  });

  const tokenBlocks = new Map<string, { from: string; block: bigint }>();

  for (const log of toLogs) {
    const args = log.args;
    if (!args) continue;
    const tokenId = String(args.id);
    const current = tokenBlocks.get(tokenId);
    if (!current || log.blockNumber > current.block) {
      tokenBlocks.set(tokenId, {
        from: (args.from as string).toLowerCase(),
        block: log.blockNumber,
      });
    }
  }

  const fromLogs = await client.getLogs({
    address: HYPERCERT_CONTRACT as `0x${string}`,
    event: {
      type: "event",
      name: "TransferSingle",
      inputs: [
        { indexed: true, name: "operator", type: "address" },
        { indexed: true, name: "from", type: "address" },
        { indexed: true, name: "to", type: "address" },
        { indexed: false, name: "id", type: "uint256" },
        { indexed: false, name: "value", type: "uint256" },
      ],
    },
    fromBlock: BigInt(0),
    toBlock: "latest",
    args: {
      from: address as `0x${string}`,
    },
  });

  for (const log of fromLogs) {
    const args = log.args;
    if (!args) continue;
    const tokenId = String(args.id);
    const block = log.blockNumber;
    const current = tokenBlocks.get(tokenId);
    if (current && block >= current.block) {
      tokenBlocks.delete(tokenId);
    }
  }

  const ownedTokenIds = Array.from(tokenBlocks.keys());

  if (ownedTokenIds.length === 0) {
    return NextResponse.json({ hypercerts: [] });
  }

  const claimLogs = await client.getLogs({
    address: HYPERCERT_CONTRACT as `0x${string}`,
    event: {
      type: "event",
      name: "ClaimStored",
      inputs: [
        { indexed: true, name: "claimID", type: "uint256" },
        { indexed: false, name: "uri", type: "string" },
        { indexed: false, name: "totalUnits", type: "uint256" },
      ],
    },
    fromBlock: BigInt(0),
    toBlock: "latest",
  });

  const claimMap = new Map<string, { uri: string; totalUnits: bigint }>();
  for (const log of claimLogs) {
    const args = log.args;
    if (!args) continue;
    claimMap.set(String(args.claimID), {
      uri: args.uri as string,
      totalUnits: args.totalUnits as bigint,
    });
  }

  const results: HypercertEntry[] = [];

  for (const tokenId of ownedTokenIds) {
    const claim = claimMap.get(tokenId);
    if (!claim) continue;

    const metadata = await fetchMetadata(claim.uri);
    const contributors = metadata?.hypercert?.contributors?.value ?? [];
    const properties = metadata?.properties ?? [];
    const prop = (trait: string) => (properties as Array<{ trait_type: string; value: string }>).find(p => p.trait_type === trait)?.value;

    results.push({
      tokenId,
      uri: claim.uri,
      name: metadata?.name ?? "Untitled Hypercert",
      description: metadata?.description ?? "",
      image: metadata?.image ?? "",
      contributor: String(contributors[0] ?? ""),
      recordingId: prop("recording_id") ?? null,
      verificationLevel: prop("verification_level") ?? null,
      isCorroborated: prop("is_corroborated") === "true",
      isPublicShare: prop("is_public_share") === "true",
      totalUnits: String(claim.totalUnits),
      platform: prop("platform") ?? null,
      createdAt: 0,
    });
  }

  return NextResponse.json({ hypercerts: results });
}

async function fetchMetadata(uri: string): Promise<Metadata | null> {
  try {
    let cid = uri;
    if (uri.startsWith("ipfs://")) {
      cid = uri.slice(7);
    } else if (uri.startsWith("ipfs/")) {
      cid = uri.slice(5);
    }
    const data = await getFromIPFS(cid);
    if (data && typeof data === "object") {
      return data as Metadata;
    }
    return null;
  } catch {
    return null;
  }
}

async function blockTimestampFromLog(
  client: ReturnType<typeof createPublicClient>,
  blockNumber: bigint
): Promise<number> {
  try {
    const block = await client.getBlock({ blockNumber });
    return Number(block.timestamp * BigInt(1000));
  } catch {
    return 0;
  }
}
