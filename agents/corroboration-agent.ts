/**
 * Radrr Corroboration Agent — ERC-8004 autonomous agent
 *
 * Decision loop:
 *   1. DISCOVER  — fetch recent unprocessed recordings from World Chain
 *   2. PLAN      — group by GPS cluster, select candidates for comparison
 *   3. EXECUTE   — run SigLIP embeddings + cosine similarity
 *   4. VERIFY    — threshold check (≥ 0.85 similarity)
 *   5. COMMIT    — update corroboration bundle on World Chain
 *   6. REPUTATION — record task success/failure in ERC-8004 registry
 *   7. LOG       — append structured entry to agent_log.json
 */

import fs from "fs";
import path from "path";
import {
  getRecordings,
  getRecordingsByGps,
  updateCorroboration,
  incrementCredibility,
  recordAgentTaskSuccess,
  recordAgentTaskFailure,
  issueAgentCredential,
} from "../lib/worldchain";
import { runCorroboration } from "../lib/siglip";

const AGENT_ADDRESS   = process.env.WORLDCHAIN_AGENT_ADDRESS!;
const LOG_PATH        = path.join(process.cwd(), "agent_log.json");
const SIMILARITY_THRESHOLD = 0.85;
const POLL_INTERVAL_MS     = 30_000; // 30s

// ─── Structured execution log ────────────────────────────────────────────────

interface LogEntry {
  timestamp:    string;
  agent:        string;
  phase:        "discover" | "plan" | "execute" | "verify" | "commit" | "reputation" | "error";
  action:       string;
  details:      Record<string, unknown>;
  txHash?:      string;
  success:      boolean;
}

function appendLog(entry: LogEntry) {
  let existing: LogEntry[] = [];
  if (fs.existsSync(LOG_PATH)) {
    try { existing = JSON.parse(fs.readFileSync(LOG_PATH, "utf-8")); } catch {}
  }
  existing.push(entry);
  fs.writeFileSync(LOG_PATH, JSON.stringify(existing, null, 2));
}

function log(
  phase: LogEntry["phase"],
  action: string,
  details: Record<string, unknown>,
  success = true,
  txHash?: string
) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    agent:     AGENT_ADDRESS,
    phase,
    action,
    details,
    success,
    ...(txHash ? { txHash } : {}),
  };
  appendLog(entry);
  console.log(`[${entry.timestamp}] [${phase.toUpperCase()}] ${action}`, details);
}

// ─── Main decision loop ──────────────────────────────────────────────────────

async function runCycle() {
  const cycleStart = Date.now();

  // 1. DISCOVER
  log("discover", "fetch_recordings", { limit: 50 });
  let recordings: Awaited<ReturnType<typeof getRecordings>>;
  try {
    recordings = await getRecordings(0, 50);
  } catch (err) {
    log("error", "fetch_recordings_failed", { error: String(err) }, false);
    return;
  }

  const unprocessed = (recordings as Array<{
    recordingId: string;
    gpsApprox: string;
    witness: string;
    cid: string;
    corroborationBundle: string[];
  }>).filter(r => r.cid && r.corroborationBundle.length === 0);

  log("discover", "unprocessed_found", { count: unprocessed.length });
  if (unprocessed.length === 0) return;

  // 2. PLAN — group by GPS cluster
  const clusters = new Map<string, typeof unprocessed>();
  for (const rec of unprocessed) {
    const key = rec.gpsApprox;
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key)!.push(rec);
  }

  const candidateClusters = [...clusters.entries()].filter(([, recs]) => recs.length >= 2);
  log("plan", "clusters_identified", {
    totalClusters: clusters.size,
    candidateClusters: candidateClusters.length,
  });

  // 3. EXECUTE — run similarity for each cluster
  let tasksSucceeded = 0;
  let tasksFailed    = 0;

  for (const [gpsKey, cluster] of candidateClusters) {
    log("execute", "processing_cluster", { gpsKey, recordings: cluster.length });

    for (const rec of cluster) {
      try {
        // Fetch keyframes via Storacha CID (placeholder — in production, extract from video)
        const keyframes: string[] = []; // would be extracted from rec.cid

        const matchedIds = await runCorroboration({
          recordingId: rec.recordingId,
          keyframes,
          gpsApprox: rec.gpsApprox,
          witness: rec.witness,
        });

        // 4. VERIFY
        if (matchedIds.length === 0) {
          log("verify", "no_matches", { recordingId: rec.recordingId });
          continue;
        }

        log("verify", "matches_found", {
          recordingId: rec.recordingId,
          matches: matchedIds,
          threshold: SIMILARITY_THRESHOLD,
        });

        // 5. COMMIT — update on-chain
        const bundle = [rec.recordingId, ...matchedIds];
        for (const id of bundle) {
          const others = bundle.filter(b => b !== id);
          const txHash = await updateCorroboration(id, others) as string;
          log("commit", "corroboration_updated", { recordingId: id, bundle: others }, true, txHash);
        }

        // Boost credibility for all witnesses
        for (const id of bundle) {
          const matched = unprocessed.find(r => r.recordingId === id);
          if (matched?.witness) {
            await incrementCredibility(matched.witness, 10);
          }
        }

        // 6. REPUTATION — record success in ERC-8004 registry
        const repTx = await recordAgentTaskSuccess(
          AGENT_ADDRESS,
          `Corroborated ${bundle.length} recordings at ${gpsKey}`
        ) as string;
        log("reputation", "task_success_recorded", { gpsKey, bundleSize: bundle.length }, true, repTx);

        // Issue credential if first corroboration
        await issueAgentCredential(
          AGENT_ADDRESS,
          "corroboration-verified",
          "" // evidenceCid would be updated after storing log on Storacha
        ).catch(() => {}); // idempotent — ignore if already issued

        tasksSucceeded++;
      } catch (err) {
        log("error", "corroboration_failed", {
          recordingId: rec.recordingId,
          error: String(err),
        }, false);

        await recordAgentTaskFailure(
          AGENT_ADDRESS,
          `Failed to corroborate ${rec.recordingId}: ${String(err)}`
        ).catch(() => {});

        tasksFailed++;
      }
    }
  }

  const duration = Date.now() - cycleStart;
  log("reputation", "cycle_complete", {
    duration_ms: duration,
    tasksSucceeded,
    tasksFailed,
  });
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main() {
  console.log("Radrr Corroboration Agent starting...");
  console.log("Agent address:", AGENT_ADDRESS);

  // Write initial agent manifest reference
  log("discover", "agent_started", {
    agentAddress:    AGENT_ADDRESS,
    capabilities:    ["corroboration", "siglip-embedding", "gps-clustering", "on-chain-write"],
    pollIntervalMs:  POLL_INTERVAL_MS,
  });

  // Run immediately then on interval
  await runCycle();
  setInterval(runCycle, POLL_INTERVAL_MS);
}

main().catch(err => {
  console.error("Agent fatal error:", err);
  process.exit(1);
});
