"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FILFOX = "https://calibration.filfox.info/en";

interface Reputation {
  score: string;
  tasksCompleted: string;
  tasksFailed: string;
  lastUpdated: string;
}

interface AgentInfo {
  address: string;
  name: string;
  role: string;
  reputation: Reputation;
  credentials: string[];
  recentLog: Array<Record<string, unknown>>;
  totalLogEntries: number;
  decisionLoop: string[];
  pollIntervalMs: number;
  threshold?: number;
  endorsed?: boolean;
}

interface PageData {
  shared: {
    registry: string;
    contract: string;
    network: string;
    chain_id: number;
  };
  corroborationAgent: AgentInfo;
  trustAgent: AgentInfo;
}

// bg-[#0099FF] can't be reliably overridden via tailwind-merge, so use inline style
const BLUE_STYLE = { backgroundColor: "#0099FF" };

function scoreColor(score: number) {
  if (score >= 800) return "bg-chart-5 text-white";
  if (score >= 500) return "bg-main text-black";
  if (score >= 200) return "bg-chart-2 text-black";
  return "bg-chart-4 text-white";
}

function scoreLabel(score: number) {
  if (score >= 800) return "Highly Trusted";
  if (score >= 500) return "Trusted";
  if (score >= 200) return "Active";
  return "New Agent";
}

function phaseColor(phase: string): { className: string; style?: React.CSSProperties } {
  switch (phase) {
    case "commit":                     return { className: "bg-chart-5 text-white" };
    case "reputation": case "endorse": return { className: "text-white", style: BLUE_STYLE };
    case "execute":                    return { className: "bg-main text-black" };
    case "verify": case "evaluate":    return { className: "bg-chart-2 text-black" };
    case "warn": case "error":         return { className: "bg-chart-4 text-white" };
    default:                           return { className: "bg-secondary text-foreground" };
  }
}

function shortHash(hash: unknown) {
  if (typeof hash !== "string") return null;
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

function ReputationBar({ score, max = 1000 }: { score: number; max?: number }) {
  const pct = Math.min((score / max) * 100, 100);
  return (
    <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden border border-border">
      <div className="h-full bg-chart-5 transition-all duration-700" style={{ width: `${pct}%` }} />
    </div>
  );
}

function AgentCard({ agent, shared }: { agent: AgentInfo; shared: PageData["shared"] }) {
  const score = Number(agent.reputation.score);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-2 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            {agent.name}
            <Badge className="bg-chart-5 text-white">ERC-8004</Badge>
            {agent.endorsed !== undefined && (
              <Badge
                className="text-white"
                style={agent.endorsed ? BLUE_STYLE : undefined}
              >
                {agent.endorsed ? "✓ trust-endorsed" : "not endorsed"}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <p className="text-muted-foreground font-base leading-relaxed">{agent.role}</p>
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">Address</span>
            <a
              href={`${FILFOX}/address/${agent.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[#0099FF] hover:underline break-all"
            >
              {agent.address}
            </a>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-muted-foreground">Registry</span>
            <a
              href={`${FILFOX}/address/${shared.registry}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[#0099FF] hover:underline break-all"
            >
              {shared.registry}
            </a>
          </div>
          <div>
            <span className="text-muted-foreground">Poll interval: </span>
            <span className="font-mono">{agent.pollIntervalMs / 1000}s</span>
            {agent.threshold !== undefined && (
              <>
                <span className="text-muted-foreground ml-3">Threshold: </span>
                <span className="font-mono">{agent.threshold}/1000</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reputation */}
      <Card className="border-2 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Reputation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-2">
            <span className="font-heading text-3xl">{score}</span>
            <span className="text-muted-foreground text-xs font-base mb-1">/ 1000</span>
          </div>
          <ReputationBar score={score} />
          <Badge className={`${scoreColor(score)} w-full justify-center`}>
            {scoreLabel(score)}
          </Badge>
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="border border-border rounded-base p-2">
              <div className="font-heading text-lg text-chart-5">{agent.reputation.tasksCompleted}</div>
              <div className="text-muted-foreground font-base">Completed</div>
            </div>
            <div className="border border-border rounded-base p-2">
              <div className="font-heading text-lg text-destructive">{agent.reputation.tasksFailed}</div>
              <div className="text-muted-foreground font-base">Failed</div>
            </div>
          </div>
          {Number(agent.reputation.lastUpdated) > 0 && (
            <p className="text-[10px] text-muted-foreground font-base text-center">
              Updated {new Date(Number(agent.reputation.lastUpdated) * 1000).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Credentials */}
      <Card className="border-2 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Credentials</CardTitle>
        </CardHeader>
        <CardContent>
          {agent.credentials.length === 0 ? (
            <p className="text-xs text-muted-foreground font-base">No on-chain credentials yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {agent.credentials.map((c) => (
                <Badge key={c} className="text-white" style={BLUE_STYLE}>✓ {c}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decision Loop */}
      <Card className="border-2 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Decision Loop</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {agent.decisionLoop.map((phase, i) => {
            const p = phaseColor(phase);
            return (
              <div key={phase} className="flex items-center gap-2">
                <span className="text-muted-foreground font-mono text-xs w-4">{i + 1}.</span>
                <Badge className={p.className} style={p.style}>{phase}</Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function ActivityLog({ entries, total, title }: { entries: Array<Record<string, unknown>>; total: number; title: string }) {
  return (
    <Card className="border-2 border-border">
      <CardHeader>
        <CardTitle className="text-sm flex items-center justify-between flex-wrap gap-2">
          {title}
          <span className="text-xs text-muted-foreground font-base">{total} entries total</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground font-base">No activity yet</p>
        ) : entries.map((entry, i) => (
          <div key={i} className="flex flex-col gap-1 border border-border rounded-base p-3 bg-background text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-muted-foreground font-mono">
                {entry.timestamp ? new Date(String(entry.timestamp)).toLocaleString() : "—"}
              </span>
              {(() => { const p = phaseColor(String(entry.phase ?? "")); return (
                <Badge className={p.className} style={p.style}>{String(entry.phase ?? "unknown")}</Badge>
              ); })()}
              {entry.success !== undefined && (
                <span className={`ml-auto ${entry.success ? "text-chart-5" : "text-destructive"}`}>
                  {entry.success ? "✓" : "✗"}
                </span>
              )}
              {entry.passed !== undefined && (
                <span className={`ml-auto ${entry.passed ? "text-chart-5" : "text-destructive"}`}>
                  {entry.passed ? "✓" : "✗"}
                </span>
              )}
            </div>
            <p className="text-muted-foreground font-base">
              {String(entry.action ?? entry.notes ?? entry.error ?? "")}
            </p>
            {typeof (entry.details as Record<string, unknown>)?.txHash === "string" && (
              <a
                href={`${FILFOX}/tx/${(entry.details as Record<string, unknown>).txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[#0099FF] hover:underline"
              >
                tx {shortHash((entry.details as Record<string, unknown>).txHash)}
              </a>
            )}
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
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function AgentPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/agent")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("Failed to load agent data"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen flex flex-col">
      <Navbar />

      <div className="relative flex-1 px-4 sm:px-6 py-6 max-w-6xl mx-auto w-full">
        {/* Backgrounds */}
        <div aria-hidden className="absolute inset-0 bg-dot-pattern opacity-[0.04] pointer-events-none" />
        <div aria-hidden className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-chart-1 opacity-[0.08] blur-[120px] pointer-events-none animate-blob" />
        <div aria-hidden className="absolute bottom-10 -left-10 w-64 h-64 rounded-full bg-chart-5 opacity-[0.07] blur-[100px] pointer-events-none animate-blob blob-delay-2" />

        <div className="relative z-10">
          <div className="mb-6">
            <h1 className="font-heading text-3xl">Agent Network</h1>
            <p className="text-muted-foreground font-base mt-1 text-sm">
              Two ERC-8004 autonomous agents operating on Filecoin Calibration Testnet
            </p>
          </div>

          {loading && (
            <div className="text-muted-foreground font-base animate-pulse text-sm">Loading agent data…</div>
          )}

          {error && (
            <div className="text-destructive font-base text-sm">{error}</div>
          )}

          {data && (
            <div className="space-y-8">
              {/* Trust status banner */}
              <div className={`flex items-center gap-3 px-4 py-3 rounded-base border-2 text-sm font-base ${
                data.trustAgent.endorsed
                  ? "border-chart-5 bg-chart-5/10"
                  : "border-border bg-secondary"
              }`}>
                <span className="text-xl">{data.trustAgent.endorsed ? "✓" : "○"}</span>
                <div>
                  <span className="font-medium">
                    {data.trustAgent.endorsed
                      ? "Corroboration Agent is trust-endorsed"
                      : "Corroboration Agent awaiting trust endorsement"}
                  </span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    Trust Agent requires score ≥ {data.trustAgent.threshold}/1000 to issue endorsement
                  </span>
                </div>
              </div>

              {/* Two-agent grid — side by side on md+, stacked on mobile */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AgentCard agent={data.corroborationAgent} shared={data.shared} />
                <AgentCard agent={data.trustAgent} shared={data.shared} />
              </div>

              {/* Activity logs — full width, each collapsible */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ActivityLog
                  entries={data.corroborationAgent.recentLog}
                  total={data.corroborationAgent.totalLogEntries}
                  title="Corroboration Agent Log"
                />
                <ActivityLog
                  entries={data.trustAgent.recentLog}
                  total={data.trustAgent.totalLogEntries}
                  title="Trust Agent Log"
                />
              </div>

              {/* Shared infrastructure */}
              <Card className="border-2 border-border">
                <CardHeader>
                  <CardTitle className="text-sm">Shared Infrastructure</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-muted-foreground">ERC-8004 Registry</span>
                    <a href={`${FILFOX}/address/${data.shared.registry}`} target="_blank" rel="noopener noreferrer"
                      className="font-mono text-[#0099FF] hover:underline break-all">
                      {data.shared.registry}
                    </a>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-muted-foreground">Radrr Contract</span>
                    <a href={`${FILFOX}/address/${data.shared.contract}`} target="_blank" rel="noopener noreferrer"
                      className="font-mono text-[#0099FF] hover:underline break-all">
                      {data.shared.contract}
                    </a>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-muted-foreground">Network</span>
                    <span className="font-mono">{data.shared.network} ({data.shared.chain_id})</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
