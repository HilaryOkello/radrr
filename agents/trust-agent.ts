/**
 * Radrr Trust Agent — ERC-8004 autonomous trust validator
 *
 * This second agent checks the Corroboration Agent's on-chain reputation
 * score before endorsing its attestations. If the Corroboration Agent's
 * score falls below the minimum threshold (700/1000), the Trust Agent
 * flags the attestation as unendorsed and records a warning.
 *
 * Decision loop:
 *   1. FETCH     — read corroboration agent reputation from ERC-8004 registry
 *   2. EVALUATE  — check score ≥ MIN_REPUTATION_SCORE
 *   3. ENDORSE   — if passing: issue "trust-endorsed" credential to recording witness
 *   4. WARN      — if failing: log warning, skip endorsement
 *   5. LOG       — append structured entry to agent_log.json
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import fs from "fs";
import path from "path";
import {
  getAgentReputation,
  issueAgentCredential,
  recordAgentTaskSuccess,
  recordAgentTaskFailure,
} from "../lib/filecoin";

const CORROBORATION_AGENT   = process.env.FILECOIN_AGENT_ADDRESS!;
const TRUST_AGENT_ADDRESS   = process.env.FILECOIN_TRUST_AGENT_ADDRESS!;
const LOG_PATH              = path.join(process.cwd(), "agent_log.json");
const MIN_REPUTATION_SCORE  = 700;
const POLL_INTERVAL_MS      = 60_000; // 1 minute

interface TrustLogEntry {
  timestamp:      string;
  agent:          string;
  phase:          "fetch" | "evaluate" | "endorse" | "warn" | "error";
  corrobAgent:    string;
  reputationScore: number;
  threshold:      number;
  passed:         boolean;
  action:         string;
  txHash?:        string;
}

function appendLog(entry: TrustLogEntry) {
  let existing: TrustLogEntry[] = [];
  if (fs.existsSync(LOG_PATH)) {
    try { existing = JSON.parse(fs.readFileSync(LOG_PATH, "utf-8")); } catch {}
  }
  existing.push(entry);
  fs.writeFileSync(LOG_PATH, JSON.stringify(existing, null, 2));
}

async function runTrustCheck(): Promise<void> {
  const timestamp = new Date().toISOString();
  let score = 0;

  // 1. FETCH — read corroboration agent's reputation
  try {
    const rep = await getAgentReputation(CORROBORATION_AGENT) as {
      score: bigint;
      tasksCompleted: bigint;
      tasksFailed: bigint;
      lastUpdated: bigint;
    };
    score = Number(rep.score);
    console.log(`[trust-agent] Corroboration agent score: ${score}`);
  } catch (err) {
    appendLog({
      timestamp,
      agent: TRUST_AGENT_ADDRESS,
      phase: "error",
      corrobAgent: CORROBORATION_AGENT,
      reputationScore: 0,
      threshold: MIN_REPUTATION_SCORE,
      passed: false,
      action: `Failed to fetch reputation: ${err instanceof Error ? err.message : String(err)}`,
    });
    return;
  }

  // 2. EVALUATE — check threshold
  const passed = score >= MIN_REPUTATION_SCORE;

  appendLog({
    timestamp,
    agent: TRUST_AGENT_ADDRESS,
    phase: "evaluate",
    corrobAgent: CORROBORATION_AGENT,
    reputationScore: score,
    threshold: MIN_REPUTATION_SCORE,
    passed,
    action: passed
      ? `Score ${score} ≥ ${MIN_REPUTATION_SCORE} — endorsing attestations`
      : `Score ${score} < ${MIN_REPUTATION_SCORE} — refusing endorsement`,
  });

  if (!passed) {
    // 4. WARN — record failure
    console.warn(`[trust-agent] Corroboration agent score ${score} below threshold ${MIN_REPUTATION_SCORE} — skipping endorsement`);
    try {
      await recordAgentTaskFailure(TRUST_AGENT_ADDRESS, `Corroboration agent score ${score} below threshold`);
    } catch {
      // best-effort
    }
    appendLog({
      timestamp: new Date().toISOString(),
      agent: TRUST_AGENT_ADDRESS,
      phase: "warn",
      corrobAgent: CORROBORATION_AGENT,
      reputationScore: score,
      threshold: MIN_REPUTATION_SCORE,
      passed: false,
      action: "Endorsement withheld — attestation flagged as unendorsed",
    });
    return;
  }

  // 3. ENDORSE — issue trust-endorsed credential
  try {
    const txHash = await issueAgentCredential(
      CORROBORATION_AGENT,
      "trust-endorsed",
      `trust-check-${Date.now()}`
    );
    console.log(`[trust-agent] Endorsed corroboration agent. tx: ${txHash}`);

    await recordAgentTaskSuccess(TRUST_AGENT_ADDRESS, "Trust check passed — corroboration agent endorsed");

    appendLog({
      timestamp: new Date().toISOString(),
      agent: TRUST_AGENT_ADDRESS,
      phase: "endorse",
      corrobAgent: CORROBORATION_AGENT,
      reputationScore: score,
      threshold: MIN_REPUTATION_SCORE,
      passed: true,
      action: "trust-endorsed credential issued to corroboration agent",
      txHash,
    });
  } catch (err) {
    appendLog({
      timestamp: new Date().toISOString(),
      agent: TRUST_AGENT_ADDRESS,
      phase: "error",
      corrobAgent: CORROBORATION_AGENT,
      reputationScore: score,
      threshold: MIN_REPUTATION_SCORE,
      passed: false,
      action: `Failed to issue credential: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

// ─── Main loop ───────────────────────────────────────────────────────────────

async function main() {
  console.log("[trust-agent] Starting Radrr Trust Agent");
  console.log(`[trust-agent] Monitoring: ${CORROBORATION_AGENT}`);
  console.log(`[trust-agent] Min reputation threshold: ${MIN_REPUTATION_SCORE}/1000`);

  await runTrustCheck();
  setInterval(runTrustCheck, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error("[trust-agent] Fatal error:", err);
  process.exit(1);
});
