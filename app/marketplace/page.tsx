"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Recording {
  recording_id: string;
  title: string;
  gps_approx: string;
  timestamp: number;
  price_eth: string;
  sold: boolean;
  cid?: string;
  encrypted_cid?: string;
  witness: string;
  corroboration_bundle: string[];
  merkle_root: string;
}

function formatEth(wei: string): string {
  const n = Number(wei) / 1e18;
  return n.toFixed(4);
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MarketplacePage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/recordings")
      .then((r) => r.json())
      .then((d) => setRecordings(d.recordings ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = recordings.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.gps_approx.includes(search)
  );

  async function handleBuy(recording: Recording) {
    const stored = localStorage.getItem("radrr_identity");
    if (!stored) {
      toast.error("You must verify your identity before purchasing.");
      return;
    }
    const parsed = JSON.parse(stored);
    const walletAddress = parsed.walletAddress ?? parsed.nearAccountId;

    setBuying(recording.recording_id);
    try {
      toast.info("Processing payment on Filecoin FVM...");
      await new Promise((r) => setTimeout(r, 1500)); // simulate wallet tx

      const res = await fetch("/api/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordingId: recording.recording_id,
          buyerAddress: walletAddress,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      const { encryptedCid } = await res.json();
      toast.success(
        `Purchase confirmed! Hypercert minted. Use encrypted CID ${encryptedCid?.slice(0, 16)}... to decrypt via Lit Protocol.`
      );

      // Refresh list
      const updated = recordings.map((r) =>
        r.recording_id === recording.recording_id ? { ...r, sold: true } : r
      );
      setRecordings(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setBuying(null);
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b-2 border-border px-6 py-4 flex items-center justify-between bg-secondary-background">
        <Link href="/" className="text-2xl font-heading tracking-tight">radrr</Link>
        <div className="flex gap-3">
          <Link href="/dashboard"><Button variant="neutral" size="sm">Dashboard</Button></Link>
          <Link href="/record"><Button size="sm">Record</Button></Link>
        </div>
      </nav>

      {/* Header */}
      <div className="border-b-2 border-border px-6 py-8 bg-secondary-background">
        <h1 className="text-4xl font-heading mb-2">Footage Marketplace</h1>
        <p className="text-muted-foreground font-base max-w-xl">
          Every clip is cryptographically verified, stored on Filecoin, and encrypted
          with Lit Protocol. Purchases settle instantly — 85% direct to the witness.
        </p>
      </div>

      <div className="flex-1 p-6 max-w-6xl mx-auto w-full flex flex-col gap-6">
        {/* Search */}
        <Input
          placeholder="Search by title, location..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-muted-foreground font-base animate-pulse">Loading footage...</div>
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-2 border-border">
            <CardContent className="py-16 text-center">
              <div className="text-5xl mb-4">📹</div>
              <p className="font-heading text-xl mb-2">No footage yet</p>
              <p className="text-muted-foreground font-base mb-6">
                Be the first to capture and verify footage.
              </p>
              <Link href="/record">
                <Button size="lg">Start Recording →</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map((r) => (
              <FootageCard
                key={r.recording_id}
                recording={r}
                onBuy={handleBuy}
                isBuying={buying === r.recording_id}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function FootageCard({
  recording: r,
  onBuy,
  isBuying,
}: {
  recording: Recording;
  onBuy: (r: Recording) => void;
  isBuying: boolean;
}) {
  return (
    <Card className="border-2 border-border flex flex-col">
      {/* Watermark preview placeholder */}
      <div className="relative bg-gradient-to-br from-main/40 to-secondary-background aspect-video flex items-center justify-center border-b-2 border-border overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-6xl opacity-20 font-heading tracking-widest rotate-[-20deg] select-none">
            PREVIEW
          </span>
        </div>
        <div className="relative z-10 text-center p-4">
          <div className="text-4xl mb-2">📹</div>
          <div className="text-xs font-mono text-muted-foreground">
            {r.recording_id.slice(0, 20)}...
          </div>
        </div>
        {/* Badges overlay */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {r.corroboration_bundle.length > 0 && (
            <Badge className="bg-chart-5 text-white text-xs">
              Corroborated ×{r.corroboration_bundle.length}
            </Badge>
          )}
          {r.sold && (
            <Badge className="bg-chart-2 text-black text-xs">Sold</Badge>
          )}
        </div>
      </div>

      <CardHeader className="pb-2">
        <CardTitle className="text-base leading-snug">{r.title}</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 flex-1">
        {/* Metadata */}
        <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground font-mono">
          <span>📍 {r.gps_approx}</span>
          <span>🕐 {formatDate(r.timestamp)}</span>
          <span className="col-span-2 truncate">
            Root: {r.merkle_root.slice(0, 24)}...
          </span>
        </div>

        {/* Proof badges */}
        <div className="flex flex-wrap gap-1">
          <Badge variant="neutral" className="text-xs">FVM Anchored</Badge>
          {r.cid && <Badge variant="neutral" className="text-xs">Filecoin</Badge>}
          {r.encrypted_cid && <Badge variant="neutral" className="text-xs">Lit Encrypted</Badge>}
        </div>

        {/* Price + buy */}
        <div className="mt-auto pt-3 border-t-2 border-border flex items-center justify-between">
          <div>
            <div className="font-heading text-xl">{formatEth(r.price_eth)} tFIL</div>
            <div className="text-xs text-muted-foreground font-base">85% to witness</div>
          </div>
          {r.sold ? (
            <Badge className="bg-chart-2 text-black">Sold</Badge>
          ) : (
            <Button
              size="sm"
              onClick={() => onBuy(r)}
              disabled={isBuying}
            >
              {isBuying ? "Buying..." : "Buy Now"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
