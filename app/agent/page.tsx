"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FILFOX = "https://calibration.filfox.info/en";

interface AgentData {
  agent: {
    address: string;
    name: string;
    registry: string;
    contract: string;
    network: string;
    chain_id: number;
  };
  reputation: {
    score: string;
    tasksCompleted: string;
    tasksFailed: string;
    lastUpdated: string;
  };
  credentials: string[];
  recentLog: Array<Record<string, unknown>>;
  totalLogEntries: number;
}

function scoreColor(score: number) {
  if (score >= 800) return "bg-chart-5 text-white";
  if (score >= 500) return "bg-main text-black";
  if (score >= 200) return "bg-chart-2 text-black";
  return "bg-destructive text-white";
}

function phaseColor(phase: string) {
  switch (phase) {
    case "commit":     return "bg-chart-5 text-white";
    case "reputation": return "bg-[#0099FF] text-white";
    case "execute":    return "bg-main text-black";
    case "verify":     return "bg-chart-2 text-black";
    case "discover":   return "bg-secondary text-foreground";
    case "plan":       return "bg-secondary text-foreground";
    case "error":      return "bg-destructive text-white";
    default:           return "bg-secondary text-foreground";
  }
}

function formatTs(ts: unknown) {
  if (typeof ts !== "number") return "—";
  return new Date(ts).toLocaleString();
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function shortHash(hash: unknown) {
  if (typeof hash !== "string") return null;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export default function AgentPage() {
  const [data, setData] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/agent")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("Failed to load agent data"))
      .finally(() => setLoading(false));
  }, []);

  const score = data ? Number(data.reputation.score) : 0;
  const scoreMax = 1000;
  const scorePct = Math.min((score / scoreMax) * 100, 100);

  return (
    <main className="min-h-screen flex flex-col">
      <Navbar />

      <div className="relative flex-1 p-6 max-w-4xl mx-auto w-full">
        {/* Backgrounds */}
        <div aria-hidden className="absolute inset-0 bg-dot-pattern opacity-[0.04] pointer-events-none" />
        <div aria-hidden className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-chart-1 opacity-[0.08] blur-[120px] pointer-events-none animate-blob" />
        <div aria-hidden className="absolute bottom-10 -left-10 w-64 h-64 rounded-full bg-chart-5 opacity-[0.07] blur-[100px] pointer-events-none animate-blob blob-delay-2" />

        <div className="relative z-10">
          <div className="mb-6">
            <h1 className="font-heading text-3xl">Agent Status</h1>
            <p className="text-muted-foreground font-base mt-1 text-sm">
              ERC-8004 autonomous corroboration agent on Filecoin Calibration Testnet
            </p>
          </div>

          {loading && (
            <div className="text-muted-foreground font-base animate-pulse">Loading agent data…</div>
          )}

          {error && (
            <div className="text-destructive font-base">{error}</div>
          )}

          {data && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left column */}
              <div className="md:col-span-2 space-y-6">

                {/* Identity */}
                <Card className="border-2 border-border">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      Identity
                      <Badge className="bg-chart-5 text-white text-[10px]">ERC-8004</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground text-xs">Agent Address</span>
                      <a
                        href={`${FILFOX}/address/${data.agent.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs hover:underline text-[#0099FF] break-all"
                      >
                        {data.agent.address}
                      </a>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground text-xs">Registry</span>
                      <a
                        href={`${FILFOX}/address/${data.agent.registry}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs hover:underline text-[#0099FF] break-all"
                      >
                        {data.agent.registry}
                      </a>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-muted-foreground text-xs">Radrr Contract</span>
                      <a
                        href={`${FILFOX}/address/${data.agent.contract}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs hover:underline text-[#0099FF] break-all"
                      >
                        {data.agent.contract}
                      </a>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Network: </span>
                      <span className="font-base text-xs">{data.agent.network} (chain {data.agent.chain_id})</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Activity Log */}
                <Card className="border-2 border-border">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between">
                      Activity Log
                      <span className="text-xs text-muted-foreground font-base">{data.totalLogEntries} entries total</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {data.recentLog.map((entry, i) => (
                      <div
                        key={i}
                        className="flex flex-col gap-1 border border-border rounded-base p-3 bg-background text-xs"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-muted-foreground font-mono">Cycle {String(entry.cycle ?? "?")}</span>
                          <Badge className={`text-[10px] px-1.5 py-0 leading-5 ${phaseColor(String(entry.phase ?? ""))}`}>
                            {String(entry.phase ?? "unknown")}
                          </Badge>
                          <span className="text-muted-foreground ml-auto">{formatTs(entry.timestamp as number)}</span>
                        </div>
                        <p className="text-muted-foreground font-base">{String(entry.notes ?? entry.error ?? "")}</p>
                        {typeof entry.tx_hash === "string" && (
                          <a
                            href={`${FILFOX}/tx/${entry.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-[#0099FF] hover:underline"
                          >
                            tx {shortHash(entry.tx_hash)}
                          </a>
                        )}
                        {typeof entry.similarity_score === "number" && (
                          <span className="font-mono text-foreground">
                            similarity: <strong>{String(entry.similarity_score)}</strong>
                            {entry.passed !== undefined && (
                              <span className={entry.passed ? " text-chart-5" : " text-destructive"}>
                                {entry.passed ? " ✓ passed" : " ✗ below threshold"}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Right column */}
              <div className="space-y-6">
                {/* Reputation Score */}
                <Card className="border-2 border-border">
                  <CardHeader>
                    <CardTitle className="text-base">Reputation</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-end gap-2">
                      <span className="font-heading text-4xl">{score}</span>
                      <span className="text-muted-foreground text-sm font-base mb-1">/ {scoreMax}</span>
                    </div>

                    {/* Score bar */}
                    <div className="w-full h-3 bg-secondary rounded-full overflow-hidden border border-border">
                      <div
                        className="h-full bg-chart-5 transition-all duration-700"
                        style={{ width: `${scorePct}%` }}
                      />
                    </div>

                    <Badge className={`${scoreColor(score)} w-full justify-center`}>
                      {score >= 800 ? "Highly Trusted" : score >= 500 ? "Trusted" : score >= 200 ? "Active" : "New Agent"}
                    </Badge>

                    <div className="grid grid-cols-2 gap-3 text-center text-xs">
                      <div className="border border-border rounded-base p-2">
                        <div className="font-heading text-xl text-chart-5">{data.reputation.tasksCompleted}</div>
                        <div className="text-muted-foreground font-base">Completed</div>
                      </div>
                      <div className="border border-border rounded-base p-2">
                        <div className="font-heading text-xl text-destructive">{data.reputation.tasksFailed}</div>
                        <div className="text-muted-foreground font-base">Failed</div>
                      </div>
                    </div>

                    {Number(data.reputation.lastUpdated) > 0 && (
                      <p className="text-xs text-muted-foreground font-base text-center">
                        Updated {new Date(Number(data.reputation.lastUpdated) * 1000).toLocaleDateString()}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Credentials */}
                <Card className="border-2 border-border">
                  <CardHeader>
                    <CardTitle className="text-base">Credentials</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.credentials.length === 0 ? (
                      <p className="text-xs text-muted-foreground font-base">No on-chain credentials yet</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {data.credentials.map((c) => (
                          <Badge key={c} className="bg-[#0099FF] text-white text-xs">
                            ✓ {c}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Decision Loop */}
                <Card className="border-2 border-border">
                  <CardHeader>
                    <CardTitle className="text-base">Decision Loop</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {["discover", "plan", "execute", "verify", "commit", "reputation", "log"].map((phase, i) => (
                      <div key={phase} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground font-mono w-4">{i + 1}.</span>
                        <Badge className={`${phaseColor(phase)} text-[10px] px-1.5 py-0 leading-5`}>{phase}</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
