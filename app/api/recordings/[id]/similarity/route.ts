import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const LOG_PATH = path.join(process.cwd(), "agent_log.json");

interface LogEntry {
  timestamp: string;
  agent: string;
  phase: string;
  action: string;
  details: Record<string, unknown>;
  txHash?: string;
  success: boolean;
}

interface SimilarityMatch {
  recordingId: string;
  similarityScore: number;
  metadataMatch: boolean;
  method: string;
  timestamp: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // Read agent log
    let logEntries: LogEntry[] = [];
    if (fs.existsSync(LOG_PATH)) {
      try {
        logEntries = JSON.parse(fs.readFileSync(LOG_PATH, "utf-8"));
      } catch {
        // If log file is corrupted, return empty
      }
    }

    const matches: SimilarityMatch[] = [];
    const metadataChecks: LogEntry[] = [];

    // Find all relevant log entries for this recording
    for (const entry of logEntries) {
      // Check if this entry involves our recording
      const involvesRecording =
        entry.details.recordingId === id ||
        entry.details.recordingA === id ||
        entry.details.recordingB === id;

      if (!involvesRecording) continue;

      // Track metadata filter results
      if (entry.action === "metadata_passed" || entry.action === "metadata_filtered") {
        metadataChecks.push(entry);
      }

      // Track successful corroborations
      if (entry.phase === "commit" && entry.action === "corroboration_updated") {
        const bundle = entry.details.bundle as string[] | undefined;
        const similarity = entry.details.similarity as string | undefined;

        if (bundle) {
          for (const matchedId of bundle) {
            // Parse similarity score (format: "90%")
            const scoreStr = similarity?.replace("%", "") ?? "85";
            const score = parseInt(scoreStr, 10) / 100;

            // Check if metadata matched for this pair
            const metadataMatch = metadataChecks.some(
              (check) =>
                (check.details.recordingA === id && check.details.recordingB === matchedId) ||
                (check.details.recordingA === matchedId && check.details.recordingB === id)
            );

            // Avoid duplicates
            if (!matches.some((m) => m.recordingId === matchedId)) {
              matches.push({
                recordingId: matchedId,
                similarityScore: score,
                metadataMatch,
                method: (entry.details.method as string) ?? "GPS+Time+Visual",
                timestamp: entry.timestamp,
              });
            }
          }
        }
      }
    }

    // Sort by similarity score (highest first)
    matches.sort((a, b) => b.similarityScore - a.similarityScore);

    return NextResponse.json({
      recordingId: id,
      totalMatches: matches.length,
      matches,
      metadataThresholds: {
        timeWindow: "10 minutes",
        gpsPrecision: "Dynamic (0.005°-0.05°)",
        visualThreshold: "85%",
      },
      transparency: {
        totalChecks: metadataChecks.length,
        passedChecks: metadataChecks.filter((c) => c.action === "metadata_passed").length,
        filteredChecks: metadataChecks.filter((c) => c.action === "metadata_filtered").length,
      },
    });
  } catch (error) {
    console.error("[similarity API error]", error);
    return NextResponse.json(
      {
        recordingId: id,
        totalMatches: 0,
        matches: [],
        error: "Failed to fetch similarity data",
      },
      { status: 500 }
    );
  }
}
