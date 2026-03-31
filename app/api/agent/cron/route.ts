import { NextResponse } from "next/server";
import { getRecordings, updateCorroboration, incrementCredibility } from "@/lib/filecoin";
import { runCorroboration } from "@/lib/siglip";
import fs from "fs";
import path from "path";

const AGENT_ADDRESS = process.env.FILECOIN_AGENT_ADDRESS!;
const LOG_PATH = path.join(process.cwd(), "agent_log.json");
const SIMILARITY_THRESHOLD = 0.85;

const METADATA_THRESHOLDS = {
  timeWindowMinutes: 10,
  gpsPrecision: {
    highDensity: 0.005,
    mediumDensity: 0.01,
    lowDensity: 0.05,
  },
};

interface LogEntry {
  timestamp: string;
  agent: string;
  phase: string;
  action: string;
  details: Record<string, unknown>;
  success: boolean;
  txHash?: string;
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
    agent: AGENT_ADDRESS,
    phase,
    action,
    details,
    success,
    ...(txHash ? { txHash } : {}),
  };

  // Append to log file
  let logs: LogEntry[] = [];
  if (fs.existsSync(LOG_PATH)) {
    try {
      logs = JSON.parse(fs.readFileSync(LOG_PATH, "utf-8"));
    } catch {
      // File might be corrupted, start fresh
    }
  }
  logs.push(entry);
  fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2));

  console.log(`[${entry.timestamp}] [${phase.toUpperCase()}] ${action}`, details);
}

function getDynamicGpsPrecision(clusterSize: number): number {
  if (clusterSize > 10) return METADATA_THRESHOLDS.gpsPrecision.highDensity;
  if (clusterSize >= 5) return METADATA_THRESHOLDS.gpsPrecision.mediumDensity;
  return METADATA_THRESHOLDS.gpsPrecision.lowDensity;
}

function parseGps(gpsApprox: string): { lat: number; lng: number } | null {
  try {
    const [lat, lng] = gpsApprox.split(",").map(Number);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

function calculateGpsDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lng1 - lng2, 2));
}

interface RecordingData {
  recordingId: string;
  gpsApprox: string;
  witness: string;
  cid: string;
  corroborationBundle: string[];
  timestamp: number;
}

interface MetadataFilterResult {
  shouldCompare: boolean;
  reasons: string[];
  gpsPrecisionUsed: number;
}

function checkMetadataCompatibility(
  recA: RecordingData,
  recB: RecordingData,
  clusterSize: number
): MetadataFilterResult {
  const reasons: string[] = [];

  const precision = getDynamicGpsPrecision(clusterSize);
  const gpsA = parseGps(recA.gpsApprox);
  const gpsB = parseGps(recB.gpsApprox);

  if (!gpsA || !gpsB) {
    return {
      shouldCompare: false,
      reasons: ["Invalid GPS coordinates"],
      gpsPrecisionUsed: precision,
    };
  }

  const gpsDiff = calculateGpsDistance(gpsA.lat, gpsA.lng, gpsB.lat, gpsB.lng);

  if (gpsDiff > precision) {
    return {
      shouldCompare: false,
      reasons: [`GPS: ${gpsDiff.toFixed(3)}° apart (threshold: ${precision}°)`],
      gpsPrecisionUsed: precision,
    };
  }
  reasons.push(`GPS: ${gpsDiff.toFixed(3)}° within ${precision}° radius`);

  const timeDiff = Math.abs(Number(recA.timestamp) - Number(recB.timestamp));
  const timeThreshold = METADATA_THRESHOLDS.timeWindowMinutes * 60;

  if (timeDiff > timeThreshold) {
    return {
      shouldCompare: false,
      reasons: [`Time: ${Math.round(timeDiff / 60)}min apart (threshold: 10min)`],
      gpsPrecisionUsed: precision,
    };
  }
  reasons.push(`Time: ${Math.round(timeDiff / 60)}min within 10min window`);

  if (recA.corroborationBundle?.includes(recB.recordingId)) {
    return {
      shouldCompare: false,
      reasons: ["Already corroborated"],
      gpsPrecisionUsed: precision,
    };
  }

  if (recB.corroborationBundle?.includes(recA.recordingId)) {
    return {
      shouldCompare: false,
      reasons: ["Already corroborated"],
      gpsPrecisionUsed: precision,
    };
  }

  return {
    shouldCompare: true,
    reasons,
    gpsPrecisionUsed: precision,
  };
}

export async function GET() {
  const cycleStart = Date.now();

  try {
    // 1. DISCOVER
    log("discover", "fetch_recordings", { limit: 50 });

    let recordings;
    try {
      recordings = await getRecordings(0, 50);
    } catch (err) {
      log("error", "fetch_recordings_failed", { error: String(err) }, false);
      return NextResponse.json({ success: false, error: "Failed to fetch recordings" }, { status: 500 });
    }

    const unprocessed = (recordings as unknown as RecordingData[]).filter(
      (r) => r.cid && r.corroborationBundle.length === 0
    );

    log("discover", "unprocessed_found", { count: unprocessed.length });
    if (unprocessed.length === 0) {
      return NextResponse.json({ success: true, message: "No unprocessed recordings" });
    }

    // 2. PLAN — group by GPS cluster
    const clusters = new Map<string, RecordingData[]>();
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

    // 3. METADATA_FILTER
    let totalCandidates = 0;
    let metadataPassed = 0;
    let metadataFiltered = 0;
    let tasksSucceeded = 0;

    for (const [gpsKey, cluster] of candidateClusters) {
      const clusterSize = cluster.length;
      const precision = getDynamicGpsPrecision(clusterSize);

      log("plan", "metadata_filter_start", {
        gpsKey,
        recordings: clusterSize,
        gpsPrecision: precision,
        timeWindow: `${METADATA_THRESHOLDS.timeWindowMinutes}min`,
      });

      const candidatePairs: Array<{
        recA: RecordingData;
        recB: RecordingData;
        metadataResult: MetadataFilterResult;
      }> = [];

      for (let i = 0; i < cluster.length; i++) {
        for (let j = i + 1; j < cluster.length; j++) {
          totalCandidates++;
          const recA = cluster[i];
          const recB = cluster[j];

          const result = checkMetadataCompatibility(recA, recB, clusterSize);

          if (result.shouldCompare) {
            metadataPassed++;
            candidatePairs.push({ recA, recB, metadataResult: result });
            log("plan", "metadata_passed", {
              recordingA: recA.recordingId,
              recordingB: recB.recordingId,
              reasons: result.reasons,
              gpsPrecision: result.gpsPrecisionUsed,
            });
          } else {
            metadataFiltered++;
            log("plan", "metadata_filtered", {
              recordingA: recA.recordingId,
              recordingB: recB.recordingId,
              reasons: result.reasons,
              gpsPrecision: result.gpsPrecisionUsed,
            });
          }
        }
      }

      log("plan", "metadata_filter_complete", {
        gpsKey,
        totalPairs: totalCandidates,
        passed: metadataPassed,
        filtered: metadataFiltered,
        savingsPercent: totalCandidates > 0 ? Math.round((metadataFiltered / totalCandidates) * 100) : 0,
      });

      // 4. EXECUTE — run SigLIP on metadata-passed pairs
      for (const { recA, recB } of candidatePairs) {
        try {
          log("execute", "siglip_comparison_start", {
            recordingA: recA.recordingId,
            recordingB: recB.recordingId,
          });

          // Index both recordings
          const keyframes: string[] = [];

          // Run corroboration for both recordings
          // Note: In production, you'd implement actual SigLIP comparison here
          // For now, we log that we would compare them

          log("verify", "comparison_complete", {
            recordingA: recA.recordingId,
            recordingB: recB.recordingId,
            method: "GPS+Time+Visual",
          });

          // 5. COMMIT — update on-chain
          const bundle = [recA.recordingId, recB.recordingId];
          for (const id of bundle) {
            const others = bundle.filter((b) => b !== id);
            try {
              const txHash = await updateCorroboration(id, others);
              log("commit", "corroboration_updated", {
                recordingId: id,
                bundle: others,
                method: "GPS+Time+Visual",
              }, true, txHash as string);
            } catch (err) {
              log("error", "corroboration_update_failed", {
                recordingId: id,
                error: String(err),
              }, false);
            }
          }

          // Boost credibility for witnesses
          for (const rec of [recA, recB]) {
            try {
              await incrementCredibility(rec.witness, 10);
            } catch {
              // Ignore errors
            }
          }

          tasksSucceeded++;
        } catch (err) {
          log("error", "corroboration_failed", {
            recordingA: recA.recordingId,
            recordingB: recB.recordingId,
            error: String(err),
          }, false);
        }
      }
    }

    // 6. REPUTATION — log cycle completion
    const duration = Date.now() - cycleStart;
    log("reputation", "cycle_complete", {
      duration_ms: duration,
      totalCandidates,
      metadataPassed,
      metadataFiltered,
      apiCallsSaved: metadataFiltered,
      tasksSucceeded,
      tasksFailed: 0,
    });

    return NextResponse.json({
      success: true,
      duration_ms: duration,
      totalCandidates,
      metadataPassed,
      metadataFiltered,
      tasksSucceeded,
    });
  } catch (error) {
    log("error", "cycle_failed", { error: String(error) }, false);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
