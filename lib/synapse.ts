/**
 * Filecoin storage for agent logs and recording metadata.
 *
 * The Synapse SDK's FWSS and FilecoinPay contracts are not yet deployed on the
 * Filecoin Calibration testnet (chain ID 314159), so we satisfy the
 * "Filecoin Pin" requirement by pinning JSON metadata to Filecoin via Storacha
 * (w3up protocol) — the same infrastructure already used for video storage.
 *
 * The Synapse SDK client is still initialised here (with our own Multicall3
 * deployment) so it can be used for payments / provider queries once Synapse
 * ships their Calibration contracts.
 */

import { http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { uploadJson } from "./storacha";

const RPC_URL   = process.env.FILECOIN_RPC_URL ?? "https://api.calibration.node.glif.io/rpc/v1";
const AGENT_KEY = (process.env.FILECOIN_AGENT_PRIVATE_KEY ?? process.env.EVM_PLATFORM_PRIVATE_KEY) as `0x${string}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null;

/**
 * Lazily initialise a Synapse SDK client with our Multicall3 deployment.
 * (Multicall3 canonical address 0xcA11... is not on Calibration; we deployed
 *  our own at 0x519Bc263133Beee1f4CacCCb4f2EB60503177AcD.)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getSynapseClient(): Promise<any> {
  if (_client) return _client;
  const { Synapse } = await import("@filoz/synapse-sdk");
  const { calibration } = await import("@filoz/synapse-core/chains");
  const account = privateKeyToAccount(AGENT_KEY);

  const calibrationFixed = {
    ...calibration,
    contracts: {
      ...calibration.contracts,
      multicall3: {
        address: "0x519Bc263133Beee1f4CacCCb4f2EB60503177AcD" as `0x${string}`,
        blockCreated: 0,
      },
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _client = (Synapse as any).create({
    chain: calibrationFixed,
    transport: http(RPC_URL),
    account,
  });
  return _client;
}

/**
 * Pin a JSON object to Filecoin via Storacha (w3up / Filecoin Pin).
 * Returns the IPFS CID of the pinned content.
 */
export async function storeOnFilecoin(
  data: Record<string, unknown>,
  label: string
): Promise<string> {
  try {
    const cid = await uploadJson(data, `${label}.json`);
    console.log(`[filecoin-pin] stored ${label} → ${cid}`);
    return cid;
  } catch (err) {
    console.error("[filecoin-pin] storage failed:", err);
    return "";
  }
}

/**
 * Store agent execution log on Filecoin.
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
