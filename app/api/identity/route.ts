import { NextRequest, NextResponse } from "next/server";
import { JsonRpcProvider } from "near-api-js";

const CONTRACT_ID = process.env.NEAR_CONTRACT_ID!;
const NETWORK_ID = process.env.NEAR_NETWORK_ID || "testnet";
const RPC_URL =
  NETWORK_ID === "mainnet"
    ? "https://rpc.mainnet.near.org"
    : "https://rpc.testnet.near.org";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");

  if (!accountId) {
    return NextResponse.json({ error: "accountId required" }, { status: 400 });
  }

  try {
    const provider = new JsonRpcProvider({ url: RPC_URL });
    const identity = await provider.callFunction({
      contractId: CONTRACT_ID,
      method: "get_identity",
      args: { account_id: accountId },
    });
    return NextResponse.json({ identity });
  } catch (err) {
    console.error("[identity]", err);
    return NextResponse.json({ identity: null });
  }
}
