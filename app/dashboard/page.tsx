"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Recording {
  recording_id: string;
  merkle_root: string;
  gps_approx: string;
  timestamp: number;
  cid?: string;
  encrypted_cid?: string;
  title: string;
  price_yocto: string;
  sold: boolean;
  corroboration_bundle: string[];
  witness: string;
}

interface Identity {
  pseudonym: string;
  credibility_score: number;
  recording_count: number;
  total_sales: number;
  world_id_verified: boolean;
}

function formatNear(yocto: string): string {
  const n = BigInt(yocto);
  const near = Number(n) / 1e24;
  return near.toFixed(2);
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString();
}

export default function DashboardPage() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [nearAccountId, setNearAccountId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("radrr_identity");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setNearAccountId(parsed.nearAccountId);
        // Fetch from NEAR
        fetchData(parsed.nearAccountId);
      } catch {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchData(accountId: string) {
    try {
      const [identityRes, recordingsRes] = await Promise.all([
        fetch(`/api/identity?accountId=${accountId}`),
        fetch(`/api/recordings?witness=${accountId}`),
      ]);

      if (identityRes.ok) {
        const data = await identityRes.json();
        setIdentity(data.identity);
      }
      if (recordingsRes.ok) {
        const data = await recordingsRes.json();
        setRecordings(data.recordings ?? []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const credibilityColor =
    (identity?.credibility_score ?? 0) >= 80
      ? "bg-chart-2 text-black"
      : (identity?.credibility_score ?? 0) >= 40
      ? "bg-chart-3 text-black"
      : "bg-main";

  if (!nearAccountId && !loading) {
    return (
      <main className="min-h-screen flex flex-col">
        <nav className="border-b-2 border-border px-6 py-4 flex items-center justify-between bg-secondary-background">
          <Link href="/" className="text-2xl font-heading tracking-tight">radrr</Link>
        </nav>
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="border-2 border-border max-w-md w-full">
            <CardContent className="py-12 text-center">
              <div className="text-5xl mb-4">👤</div>
              <h2 className="font-heading text-xl mb-3">No identity found</h2>
              <p className="text-muted-foreground font-base mb-6">
                You need to verify your identity with World ID before accessing your dashboard.
              </p>
              <Link href="/verify">
                <Button size="lg">Verify Identity →</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b-2 border-border px-6 py-4 flex items-center justify-between bg-secondary-background">
        <Link href="/" className="text-2xl font-heading tracking-tight">radrr</Link>
        <div className="flex gap-3">
          <Link href="/record"><Button size="sm">Record</Button></Link>
          <Link href="/marketplace"><Button variant="neutral" size="sm">Marketplace</Button></Link>
        </div>
      </nav>

      <div className="flex-1 p-6 max-w-6xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-muted-foreground font-base animate-pulse">Loading...</div>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {/* Identity card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="border-2 border-border md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <span>{identity?.pseudonym ?? nearAccountId}</span>
                    {identity?.world_id_verified && (
                      <Badge className="bg-chart-2 text-black text-xs">
                        World ID Verified
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Stat
                    label="Credibility"
                    value={String(identity?.credibility_score ?? "—")}
                    highlight={credibilityColor}
                  />
                  <Stat label="Recordings" value={String(identity?.recording_count ?? recordings.length)} />
                  <Stat label="Sales" value={String(identity?.total_sales ?? "—")} />
                  <Stat
                    label="Identity"
                    value="ERC-8004"
                    highlight="bg-chart-5 text-white"
                  />
                </CardContent>
              </Card>

              <Card className="border-2 border-border">
                <CardContent className="pt-6 flex flex-col gap-3">
                  <Link href="/record" className="block">
                    <Button className="w-full">New Recording</Button>
                  </Link>
                  <Link href="/marketplace" className="block">
                    <Button variant="neutral" className="w-full">
                      Browse Marketplace
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>

            {/* Recordings */}
            <Tabs defaultValue="all">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-heading">Your Footage</h2>
                <TabsList>
                  <TabsTrigger value="all">All ({recordings.length})</TabsTrigger>
                  <TabsTrigger value="sold">
                    Sold ({recordings.filter((r) => r.sold).length})
                  </TabsTrigger>
                  <TabsTrigger value="corroborated">
                    Corroborated ({recordings.filter((r) => r.corroboration_bundle.length > 0).length})
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="all">
                <RecordingsList recordings={recordings} />
              </TabsContent>
              <TabsContent value="sold">
                <RecordingsList recordings={recordings.filter((r) => r.sold)} />
              </TabsContent>
              <TabsContent value="corroborated">
                <RecordingsList
                  recordings={recordings.filter(
                    (r) => r.corroboration_bundle.length > 0
                  )}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground font-base">{label}</span>
      <span
        className={`text-2xl font-heading px-1 inline-block ${
          highlight ?? ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function RecordingsList({ recordings }: { recordings: Recording[] }) {
  if (recordings.length === 0) {
    return (
      <Card className="border-2 border-border">
        <CardContent className="py-12 text-center text-muted-foreground font-base">
          No recordings yet.{" "}
          <Link href="/record" className="underline">
            Start recording
          </Link>
          .
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {recordings.map((r) => (
        <Card key={r.recording_id} className="border-2 border-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-heading text-base">{r.title}</span>
                  {r.sold && <Badge className="bg-chart-2 text-black text-xs">Sold</Badge>}
                  {r.corroboration_bundle.length > 0 && (
                    <Badge className="bg-chart-5 text-white text-xs">
                      Corroborated ×{r.corroboration_bundle.length}
                    </Badge>
                  )}
                  {r.encrypted_cid && (
                    <Badge variant="neutral" className="text-xs">Encrypted</Badge>
                  )}
                  {r.cid && (
                    <Badge variant="neutral" className="text-xs">On Filecoin</Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-1 flex flex-wrap gap-3">
                  <span>ID: {r.recording_id.slice(0, 24)}...</span>
                  <span>📍 {r.gps_approx}</span>
                  <span>🕐 {formatDate(r.timestamp)}</span>
                </div>
                <div className="text-xs font-mono text-muted-foreground truncate">
                  Root: {r.merkle_root.slice(0, 32)}...
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <span className="font-heading text-lg">
                  {r.price_yocto ? formatNear(r.price_yocto) : "—"} NEAR
                </span>
                {r.cid && (
                  <a
                    href={`https://${r.cid}.ipfs.w3s.link`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="neutral" size="sm">View on IPFS</Button>
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
