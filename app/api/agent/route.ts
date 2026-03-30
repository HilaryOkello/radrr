import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";
import { getAgentReputation, hasAgentCredential } from "@/lib/filecoin";

const AGENT_ADDRESS = "0x3B5FA5297f158cBB1c375372594858BB3B150463";
const AGENT_REGISTRY = "0x7Fe730B43d6A799c74573C3d24da7081Ef1EecDc";
const RADRR_CONTRACT = "0x7558AF2375276Aa735B3766dd57F57b567A86cA2";

export async function GET() {
  try {
    // Load agent log from public dir
    const logPath = path.join(process.cwd(), "public", "agent_log.json");
    const rawLog = readFileSync(logPath, "utf-8");
    const logEntries = JSON.parse(rawLog) as Array<Record<string, unknown>>;

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
