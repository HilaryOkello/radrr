/**
 * Filecoin Synapse SDK integration.
 * Used to store agent execution logs and recording metadata as verified
 * Filecoin storage deals — satisfying the Filecoin Foundation bounty requirement.
 *
 * Synapse SDK: @filoz/synapse-sdk
 * Network: Filecoin Calibration Testnet (chain ID 314159)
 */

import { http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { filecoinCalibration } from "./filecoin";

const RPC_URL   = process.env.FILECOIN_RPC_URL ?? "https://api.calibration.node.glif.io/rpc/v1";
const AGENT_KEY = (process.env.FILECOIN_AGENT_PRIVATE_KEY ?? process.env.EVM_PLATFORM_PRIVATE_KEY) as `0x${string}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getClient(): Promise<any> {
  if (_client) return _client;
  const { Synapse } = await import("@filoz/synapse-sdk");
  const account = privateKeyToAccount(AGENT_KEY);
  _client = Synapse.create({
    chain: filecoinCalibration as never,
    transport: http(RPC_URL),
    account,
  });
  return _client;
}

/**
 * Store a JSON object on Filecoin via Synapse SDK.
 * Returns the CID of the stored content.
 */
export async function storeOnFilecoin(
  data: Record<string, unknown>,
  label: string
): Promise<string> {
  try {
    const client = await getClient();
    const bytes  = new TextEncoder().encode(JSON.stringify(data, null, 2));
    const cid    = await client.storage.upload(bytes, { label });
    return cid;
  } catch (err) {
    // Non-fatal: log storage is best-effort
    console.error("[synapse] storage failed:", err);
    return "";
  }
}

/**
 * Store agent execution log on Filecoin.
 * Called by the corroboration agent after each cycle.
 */
export async function storeAgentLog(
  log: unknown[],
  agentAddress: string
): Promise<string> {
  return storeOnFilecoin(
    { agent: agentAddress, log, storedAt: new Date().toISOString() },
    `radrr-agent-log-${agentAddress.slice(0, 8)}`
  );
}

/**
 * Store recording metadata on Filecoin for verifiable provenance.
 * Called after a recording is anchored on-chain.
 */
export async function storeRecordingMetadata(metadata: {
  recordingId: string;
  merkleRoot:  string;
  gpsApprox:   string;
  witness:     string;
  timestamp:   number;
  txHash:      string;
}): Promise<string> {
  return storeOnFilecoin(
    { ...metadata, schema: "radrr/recording/v1" },
    `radrr-recording-${metadata.recordingId.slice(0, 8)}`
  );
}
