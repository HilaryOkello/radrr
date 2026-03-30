import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import { getAgentReputation, hasAgentCredential } from "@/lib/filecoin";

// Read from environment variables
const AGENT_ADDRESS = process.env.FILECOIN_AGENT_ADDRESS || "";
const AGENT_REGISTRY = process.env.FILECOIN_AGENT_REGISTRY_ADDRESS || "";
const RADRR_CONTRACT = process.env.FILECOIN_CONTRACT_ADDRESS || "";

export async function GET() {
  try {
    // Load agent log from project root (where the agent writes it)
    let logEntries: Array<Record<string, unknown>> = [];
    try {
      const logPath = path.join(process.cwd(), "agent_log.json");
      const rawLog = readFileSync(logPath, "utf-8");
      logEntries = JSON.parse(rawLog) as Array<Record<string, unknown>>;
    } catch {
      // Log file doesn't exist yet or is corrupted
      logEntries = [];
    }

    // Fetch on-chain reputation (BigInts must be serialized to strings)
    let reputation: {
      score: string;
      tasksCompleted: string;
      tasksFailed: string;
      lastUpdated: string;
    } | null = null;

    try {
      const raw = await getAgentReputation(AGENT_ADDRESS) as {
        score: bigint;
        tasksCompleted: bigint;
        tasksFailed: bigint;
        lastUpdated: bigint;
      };
      reputation = {
        score: raw.score.toString(),
        tasksCompleted: raw.tasksCompleted.toString(),
        tasksFailed: raw.tasksFailed.toString(),
        lastUpdated: raw.lastUpdated.toString(),
      };
    } catch {
      // Registry may not have this agent — return default
      reputation = { score: "0", tasksCompleted: "0", tasksFailed: "0", lastUpdated: "0" };
    }

    // Check known credentials
    let credentials: string[] = [];
    try {
      const credTypes = ["corroboration", "similarity-analysis", "on-chain-attestation"];
      const checks = await Promise.all(
        credTypes.map((c) => hasAgentCredential(AGENT_ADDRESS, c).then((has) => has ? c : null))
      );
      credentials = checks.filter(Boolean) as string[];
    } catch {
      credentials = [];
    }

    // Recent log: last 10 entries
    const recentLog = logEntries.slice(-10).reverse();

    return NextResponse.json({
      agent: {
        address: AGENT_ADDRESS,
        name: "Radrr Corroboration Agent",
        registry: AGENT_REGISTRY,
        contract: RADRR_CONTRACT,
        network: "Filecoin Calibration Testnet",
        chain_id: 314159,
      },
      reputation,
      credentials,
      recentLog,
      totalLogEntries: logEntries.length,
    });
  } catch (err) {
    console.error("[agent route]", err);
    return NextResponse.json({ error: "Failed to load agent data" }, { status: 500 });
  }
}
