"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { ConnectWallet } from "@/components/ConnectWallet";
import { FootageCard, type FootageRecording } from "@/components/FootageCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Identity {
  pseudonym: string;
  credibility_score: number;
  recording_count: number;
  total_sales: number;
}


export default function DashboardPage() {
  const { address: connectedAddress } = useAccount();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [recordings, setRecordings] = useState<FootageRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    // Prefer connected wallet; fall back to localStorage
    const addr = connectedAddress ?? (() => {
      try {
        const stored = localStorage.getItem("radrr_identity");
        if (stored) {
          const parsed = JSON.parse(stored);
          return parsed.walletAddress ?? parsed.nearAccountId ?? null;
        }
      } catch { /* ignore */ }
      return null;
    })();

    if (addr) {
      setWalletAddress(addr);
      fetchData(addr);
    } else {
      setLoading(false);
    }
  }, [connectedAddress]);

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

  if (!walletAddress && !loading) {
    return (
      <main className="min-h-screen flex flex-col">
        <nav className="border-b-2 border-border px-6 py-4 flex items-center justify-between bg-secondary-background">
          <Link href="/" className="text-2xl font-heading tracking-tight">radrr</Link>
          <ConnectWallet />
        </nav>
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="border-2 border-border max-w-md w-full">
            <CardContent className="py-12 text-center">
              <div className="text-5xl mb-4">👤</div>
              <h2 className="font-heading text-xl mb-3">Connect your wallet</h2>
              <p className="text-muted-foreground font-base mb-6">
                Connect MetaMask to view your recordings, or start recording to create your on-chain identity.
              </p>
              <div className="flex flex-col gap-3">
                <ConnectWallet />
                <Link href="/record">
                  <Button size="lg" variant="neutral" className="w-full">Start Recording →</Button>
                </Link>
              </div>
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
        <div className="flex gap-3 items-center">
          <Link href="/record"><Button size="sm">Record</Button></Link>
          <Link href="/marketplace"><Button variant="neutral" size="sm">Marketplace</Button></Link>
          <ConnectWallet />
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
                    <span>{identity?.pseudonym ?? walletAddress}</span>
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
                <RecordingsList recordings={recordings} walletAddress={walletAddress ?? undefined} />
              </TabsContent>
              <TabsContent value="sold">
                <RecordingsList recordings={recordings.filter((r) => r.sold)} walletAddress={walletAddress ?? undefined} />
              </TabsContent>
              <TabsContent value="corroborated">
                <RecordingsList
                  recordings={recordings.filter((r) => r.corroboration_bundle.length > 0)}
                  walletAddress={walletAddress ?? undefined}
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

function RecordingsList({
  recordings,
  walletAddress,
}: {
  recordings: FootageRecording[];
  walletAddress?: string;
}) {
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
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {recordings.map((r) => (
        <FootageCard
          key={r.recording_id}
          recording={r}
          mode="dashboard"
          walletAddress={walletAddress}
        />
      ))}
    </div>
  );
}
