import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import { getAgentReputation, hasAgentCredential } from "@/lib/filecoin";

const CORROBORATION_AGENT = process.env.FILECOIN_AGENT_ADDRESS || "";
const TRUST_AGENT         = process.env.FILECOIN_TRUST_AGENT_ADDRESS || "";
const AGENT_REGISTRY      = process.env.FILECOIN_AGENT_REGISTRY_ADDRESS || "";
const RADRR_CONTRACT      = process.env.FILECOIN_CONTRACT_ADDRESS || "";

async function fetchReputation(address: string) {
  if (!address) return { score: "0", tasksCompleted: "0", tasksFailed: "0", lastUpdated: "0" };
  try {
    const raw = await getAgentReputation(address) as {
      score: bigint;
      tasksCompleted: bigint;
      tasksFailed: bigint;
      lastUpdated: bigint;
    };
    return {
      score: raw.score.toString(),
      tasksCompleted: raw.tasksCompleted.toString(),
      tasksFailed: raw.tasksFailed.toString(),
      lastUpdated: raw.lastUpdated.toString(),
    };
  } catch {
    return { score: "0", tasksCompleted: "0", tasksFailed: "0", lastUpdated: "0" };
  }
}

async function fetchCredentials(address: string, types: string[]) {
  if (!address) return [];
  try {
    const checks = await Promise.all(
      types.map((c) => hasAgentCredential(address, c).then((has) => (has ? c : null)))
    );
    return checks.filter(Boolean) as string[];
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    // Load shared agent log
    let logEntries: Array<Record<string, unknown>> = [];
    try {
      const logPath = path.join(process.cwd(), "agent_log.json");
      logEntries = JSON.parse(readFileSync(logPath, "utf-8"));
    } catch {
      logEntries = [];
    }

    // Fetch both agents in parallel
    const [corrReputation, trustReputation, corrCredentials, trustCredentials] = await Promise.all([
      fetchReputation(CORROBORATION_AGENT),
      fetchReputation(TRUST_AGENT),
      fetchCredentials(CORROBORATION_AGENT, ["corroboration", "similarity-analysis", "on-chain-attestation", "trust-endorsed"]),
      fetchCredentials(TRUST_AGENT, ["trust-validator"]),
    ]);

    // Split log by agent — trust agent entries have a corrobAgent field
    const corrLog = logEntries.filter((e) => !e.corrobAgent).slice(-10).reverse();
    const trustLog = logEntries.filter((e) => !!e.corrobAgent).slice(-5).reverse();

    return NextResponse.json({
      shared: {
        registry: AGENT_REGISTRY,
        contract: RADRR_CONTRACT,
        network: "Filecoin Calibration Testnet",
        chain_id: 314159,
      },
      corroborationAgent: {
        address: CORROBORATION_AGENT,
        name: "Corroboration Agent",
        role: "Discovers recordings, runs SigLIP 2 similarity analysis, and commits corroboration bundles on-chain.",
        reputation: corrReputation,
        credentials: corrCredentials,
        recentLog: corrLog,
        totalLogEntries: logEntries.filter((e) => !e.corrobAgent).length,
        decisionLoop: ["discover", "plan", "execute", "verify", "commit", "reputation", "log"],
        pollIntervalMs: 30000,
      },
      trustAgent: {
        address: TRUST_AGENT,
        name: "Trust Agent",
        role: "Monitors the Corroboration Agent's ERC-8004 reputation. Issues trust-endorsed credential if score ≥ 700/1000.",
        reputation: trustReputation,
        credentials: trustCredentials,
        recentLog: trustLog,
        totalLogEntries: logEntries.filter((e) => !!e.corrobAgent).length,
        decisionLoop: ["fetch", "evaluate", "endorse", "warn"],
        pollIntervalMs: 60000,
        threshold: 700,
        endorsed: corrCredentials.includes("trust-endorsed"),
      },
    });
  } catch (err) {
    console.error("[agent route]", err);
    return NextResponse.json({ error: "Failed to load agent data" }, { status: 500 });
  }
}
