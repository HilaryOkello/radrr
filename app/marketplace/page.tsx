"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FootageCard, type FootageRecording } from "@/components/FootageCard";
import { ConnectWallet } from "@/components/ConnectWallet";

export default function MarketplacePage() {
  const { address: connectedAddress } = useAccount();
  const [recordings, setRecordings] = useState<FootageRecording[]>([]);
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

  async function handleBuy(recording: FootageRecording) {
    if (!connectedAddress) {
      toast.error("Connect your wallet to purchase.");
      return;
    }
    const walletAddress = connectedAddress;

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
        <div className="flex gap-3 items-center">
          <Link href="/dashboard"><Button variant="neutral" size="sm">Dashboard</Button></Link>
          <Link href="/record"><Button size="sm">Record</Button></Link>
          <ConnectWallet />
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
                mode="marketplace"
                walletAddress={connectedAddress}
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

