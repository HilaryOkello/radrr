"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { FootageCard, type FootageRecording } from "@/components/FootageCard";
import { ConnectWallet } from "@/components/ConnectWallet";

interface SerializedBid {
  index: number;
  bidder: string;
  amount: string; // wei
  timestamp: number;
  status: string;
}

function highestPendingBid(bids: SerializedBid[]): SerializedBid | undefined {
  return bids
    .filter((b) => b.status === "Pending")
    .sort((a, b) => Number(BigInt(b.amount) - BigInt(a.amount)))[0];
}

export default function MarketplacePage() {
  const { address: connectedAddress } = useAccount();
  const [recordings, setRecordings] = useState<FootageRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [buying, setBuying] = useState<string | null>(null);
  const [bidsMap, setBidsMap] = useState<Record<string, SerializedBid[]>>({});
  const [bidTarget, setBidTarget] = useState<FootageRecording | null>(null);
  const [bidAmount, setBidAmount] = useState("0.0005");
  const [bidding, setBidding] = useState(false);

  useEffect(() => {
    fetch("/api/recordings")
      .then((r) => r.json())
      .then((d) => {
        const recs: FootageRecording[] = d.recordings ?? [];
        setRecordings(recs);
        // Fetch bids for all unsold recordings
        recs
          .filter((r) => !r.sold)
          .forEach((r) => {
            fetch(`/api/bids?recordingId=${r.recording_id}`)
              .then((res) => res.json())
              .then((data) => {
                if (data.bids?.length > 0) {
                  setBidsMap((prev) => ({ ...prev, [r.recording_id]: data.bids }));
                }
              })
              .catch(() => {});
          });
      })
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
    setBuying(recording.recording_id);
    try {
      toast.info("Processing payment on Filecoin FVM...");
      await new Promise((r) => setTimeout(r, 1500));

      const res = await fetch("/api/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordingId: recording.recording_id,
          buyerAddress: connectedAddress,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      const { encryptedCid } = await res.json();
      toast.success(
        `Purchase confirmed! Hypercert minted. Encrypted CID: ${encryptedCid?.slice(0, 16)}...`
      );
      setRecordings((prev) =>
        prev.map((r) =>
          r.recording_id === recording.recording_id ? { ...r, sold: true } : r
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setBuying(null);
    }
  }

  const handleOpenBid = useCallback(
    (recording: FootageRecording) => {
      if (!connectedAddress) {
        toast.error("Connect your wallet to make an offer.");
        return;
      }
      setBidTarget(recording);
      setBidAmount("0.0005");
    },
    [connectedAddress]
  );

  async function handleSubmitBid() {
    if (!bidTarget || !connectedAddress) return;
    const amount = parseFloat(bidAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid bid amount.");
      return;
    }

    setBidding(true);
    try {
      toast.info("Placing bid on Filecoin FVM...");
      const res = await fetch("/api/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordingId: bidTarget.recording_id,
          bidder: connectedAddress,
          amountEth: bidAmount,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      const newBid: SerializedBid = {
        index: (bidsMap[bidTarget.recording_id]?.length ?? 0),
        bidder: connectedAddress,
        amount: String(BigInt(Math.round(amount * 1e18))),
        timestamp: Date.now() / 1000,
        status: "Pending",
      };
      setBidsMap((prev) => ({
        ...prev,
        [bidTarget.recording_id]: [...(prev[bidTarget.recording_id] ?? []), newBid],
      }));

      toast.success(`Offer of ${bidAmount} tFIL placed! The witness will be notified.`);
      setBidTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bid failed");
    } finally {
      setBidding(false);
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
          with Lit Protocol. Buy at asking price or make an offer — 85% goes direct to the witness.
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
            {filtered.map((r) => {
              const bids = bidsMap[r.recording_id] ?? [];
              const pendingBids = bids.filter((b) => b.status === "Pending");
              const top = highestPendingBid(bids);
              return (
                <FootageCard
                  key={r.recording_id}
                  recording={r}
                  mode="marketplace"
                  walletAddress={connectedAddress}
                  onBuy={handleBuy}
                  isBuying={buying === r.recording_id}
                  onBid={handleOpenBid}
                  bidCount={pendingBids.length}
                  highestBid={top?.amount}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Make Offer Dialog */}
      <Dialog open={!!bidTarget} onOpenChange={(open) => !open && setBidTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Make an Offer</DialogTitle>
            <DialogDescription>
              Offer a price for &ldquo;{bidTarget?.title || "Untitled Recording"}&rdquo;. Your tFIL will be
              escrowed on-chain — the witness can accept or reject.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-1 text-xs text-muted-foreground font-mono bg-secondary-background rounded-base p-3 border-2 border-border">
              <div>Asking price: <span className="font-heading text-foreground">{((Number(bidTarget?.price_eth ?? "0")) / 1e18).toFixed(4)} tFIL</span></div>
              {bidTarget && (bidsMap[bidTarget.recording_id]?.filter(b => b.status === "Pending").length ?? 0) > 0 && (
                <div>Active offers: <span className="font-heading text-foreground">{bidsMap[bidTarget.recording_id].filter(b => b.status === "Pending").length}</span></div>
              )}
            </div>

            <div>
              <label className="text-xs font-base text-muted-foreground mb-1 block">
                Your offer (tFIL)
              </label>
              <Input
                type="number"
                step="0.0001"
                min="0.0001"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder="0.0005"
              />
              <div className="text-xs text-muted-foreground mt-1">
                Funds held in escrow · refunded if rejected
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="neutral"
                className="flex-1"
                onClick={() => setBidTarget(null)}
                disabled={bidding}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmitBid}
                disabled={bidding}
              >
                {bidding ? "Placing…" : "Place Offer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
