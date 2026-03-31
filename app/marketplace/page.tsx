"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAccount, useSendTransaction } from "wagmi";
import { createPublicClient, http, encodeFunctionData, parseEther } from "viem";
import { filecoinCalibration } from "viem/chains";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Navbar } from "@/components/Navbar";
import { ConnectWallet } from "@/components/ConnectWallet";
import { MarketplaceCard } from "@/components/MarketplaceCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { FootageRecording } from "@/components/FootageCard";

interface Bid {
  index: number;
  bidder: string;
  amount: string;
  timestamp: number;
  status: string;
}

type Filter = "all" | "verified" | "forsale" | "public";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",      label: "All"      },
  { key: "verified", label: "✓ Verified" },
  { key: "forsale",  label: "For Sale"  },
  { key: "public",   label: "Public"    },
];

function highestPending(bids: Bid[]) {
  return bids
    .filter((b) => b.status === "Pending")
    .sort((a, b) => Number(BigInt(b.amount) - BigInt(a.amount)))[0];
}

export default function MarketplacePage() {
  const { address: connectedAddress, isConnected } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();
  const [recordings, setRecordings]   = useState<FootageRecording[]>([]);
  const [bidsMap, setBidsMap]         = useState<Record<string, Bid[]>>({});
  const [userBids, setUserBids]       = useState<Set<string>>(new Set()); // Track which recordings user has bid on
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [filter, setFilter]           = useState<Filter>("all");
  const [buying, setBuying]           = useState<string | null>(null);
  const [bidTarget, setBidTarget]     = useState<FootageRecording | null>(null);
  const [bidAmount, setBidAmount]     = useState("0.0005");
  const [bidding, setBidding]         = useState(false);

  // Contract configuration
  const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_FILECOIN_CONTRACT_ADDRESS as `0x${string}`;
  
  const RADRR_BID_ABI = [{
    type: "function",
    name: "placeBidFor",
    stateMutability: "payable",
    inputs: [{ name: "recordingId", type: "string" }, { name: "bidder", type: "address" }],
    outputs: [],
  }] as const;

  const RADRR_PURCHASE_ABI = [{
    type: "function",
    name: "purchase",
    stateMutability: "payable",
    inputs: [{ name: "recordingId", type: "string" }],
    outputs: [],
  }] as const;

  useEffect(() => {
    if (!isConnected) return;
    fetch("/api/recordings")
      .then((r) => r.json())
      .then((d) => {
        const recs: FootageRecording[] = d.recordings ?? [];
        setRecordings(recs);
        // Fetch bids for unsold recordings in parallel
        Promise.all(
          recs
            .filter((r) => !r.sold)
            .map((r) =>
              fetch(`/api/bids?recordingId=${r.recording_id}`)
                .then((res) => res.json())
                .then((data) => ({ id: r.recording_id, bids: data.bids ?? [] }))
                .catch(() => ({ id: r.recording_id, bids: [] }))
            )
        ).then((results) => {
          const map: Record<string, Bid[]> = {};
          for (const { id, bids } of results) {
            if (bids.length > 0) map[id] = bids;
          }
          setBidsMap(map);
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isConnected]);

  const filtered = useMemo(() => {
    let list = recordings;
    if (filter === "verified") list = list.filter((r) => r.corroboration_bundle.length > 0);
    if (filter === "forsale")  list = list.filter((r) => !r.sold);
    if (filter === "public")   list = list.filter((r) => r.visibility_level === "full");
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) => r.title.toLowerCase().includes(q) || r.gps_approx.toLowerCase().includes(q)
      );
    }
    return list;
  }, [recordings, filter, search]);

  const stats = useMemo(() => ({
    total:    recordings.length,
    verified: recordings.filter((r) => r.corroboration_bundle.length > 0).length,
    forSale:  recordings.filter((r) => !r.sold).length,
  }), [recordings]);

  async function handleBuy(recording: FootageRecording) {
    if (!connectedAddress) { toast.error("Connect your wallet to purchase."); return; }
    setBuying(recording.recording_id);
    try {
      // First check if already purchased (e.g., via bid acceptance)
      toast.info("Checking purchase status...");
      const checkRes = await fetch("/api/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingId: recording.recording_id, buyerAddress: connectedAddress }),
      });

      const checkData = await checkRes.json();

      if (checkData.alreadyPurchased) {
        // Already purchased via bid - no transaction needed
        toast.success("Content purchased via offer!", { position: "top-center" });
      } else {
        // Not yet purchased - need to pay listing price
        toast.info("Sending purchase transaction...");

        // Create public client for waiting
        const publicClient = createPublicClient({
          chain: filecoinCalibration,
          transport: http(process.env.NEXT_PUBLIC_FILECOIN_RPC_URL ?? "https://api.calibration.node.glif.io/rpc/v1"),
        });

        // Encode the function call
        const data = encodeFunctionData({
          abi: RADRR_PURCHASE_ABI,
          functionName: "purchase",
          args: [recording.recording_id],
        });

        // Parse price to wei
        const priceWei = parseEther(recording.price_eth.toString());

        // Send transaction via MetaMask (wallet)
        const hash = await sendTransactionAsync({
          to: CONTRACT_ADDRESS,
          data,
          value: priceWei,
          chainId: filecoinCalibration.id,
        });

        toast.info("Waiting for transaction confirmation...");

        // Wait for the transaction to be confirmed
        await publicClient.waitForTransactionReceipt({ hash });

        toast.success("Transaction confirmed! Verifying purchase...");

        // Re-verify the purchase on-chain
        const verifyRes = await fetch("/api/purchase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordingId: recording.recording_id, buyerAddress: connectedAddress }),
        });

        if (!verifyRes.ok) {
          const errorData = await verifyRes.json();
          throw new Error(errorData.error || "Purchase verification failed");
        }
      }

      toast.success("🎉 Footage purchased", { position: "top-center" });
      setRecordings((prev) =>
        prev.map((r) => r.recording_id === recording.recording_id ? { ...r, sold: true } : r)
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setBuying(null);
    }
  }

  const handleOpenBid = useCallback((recording: FootageRecording) => {
    if (!connectedAddress) { toast.error("Connect your wallet to make an offer."); return; }
    setBidTarget(recording);
    setBidAmount("0.0005");
  }, [connectedAddress]);

  async function handleSubmitBid() {
    if (!bidTarget || !connectedAddress) return;
    const amount = parseFloat(bidAmount);
    if (!amount || amount <= 0) { toast.error("Enter a valid bid amount."); return; }
    setBidding(true);
    try {
      toast.info("Placing offer on Filecoin FVM…");

      // Parse bid amount to wei
      const amountWei = parseEther(bidAmount);

      // Create public client for waiting
      const publicClient = createPublicClient({
        chain: filecoinCalibration,
        transport: http(process.env.NEXT_PUBLIC_FILECOIN_RPC_URL ?? "https://api.calibration.node.glif.io/rpc/v1"),
      });

      // Encode function call
      const data = encodeFunctionData({
        abi: RADRR_BID_ABI,
        functionName: "placeBidFor",
        args: [bidTarget.recording_id, connectedAddress],
      });

      // Send transaction via MetaMask (buyer's wallet)
      const hash = await sendTransactionAsync({
        to: CONTRACT_ADDRESS,
        data,
        value: amountWei,
        chainId: filecoinCalibration.id,
      });

      toast.info("Waiting for confirmation...");

      // Wait for the transaction to be confirmed
      await publicClient.waitForTransactionReceipt({ hash });

      // Update UI - add bid to local state
      const newBid: Bid = {
        index: bidsMap[bidTarget.recording_id]?.length ?? 0,
        bidder: connectedAddress,
        amount: String(BigInt(Math.round(amount * 1e18))),
        timestamp: Date.now() / 1000,
        status: "Pending",
      };
      setBidsMap((prev) => ({
        ...prev,
        [bidTarget.recording_id]: [...(prev[bidTarget.recording_id] ?? []), newBid],
      }));

      // Mark this recording as bid on by user
      setUserBids((prev) => new Set(prev).add(bidTarget.recording_id));

      toast.success(`💸 Offer of ${bidAmount} tFIL placed`, { position: "top-center" });
      setBidTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bid failed");
    } finally {
      setBidding(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col">
      <Navbar />

      {/* ── Hero banner ── */}
      <div className="relative overflow-hidden border-b-2 border-border bg-main px-4 sm:px-8 py-8 sm:py-10">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,white_0%,transparent_65%)] opacity-[0.15] pointer-events-none" />
        <div aria-hidden className="absolute inset-0 bg-diagonal-stripes pointer-events-none" />
        <div className="relative z-10 max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl sm:text-5xl font-heading leading-tight mb-2">
              Footage Marketplace
            </h1>
            <p className="text-sm sm:text-base font-base max-w-xl opacity-80">
              Every clip cryptographically verified, stored on Filecoin, encrypted end-to-end.
              80% of every sale goes direct to the witness.
            </p>
          </div>
          {isConnected && !loading && (
            <div className="flex gap-4 sm:gap-8 shrink-0">
              {[
                { value: stats.total,    label: "Clips"    },
                { value: stats.verified, label: "Verified" },
                { value: stats.forSale,  label: "For Sale" },
              ].map((s) => (
                <div key={s.label} className="text-center">
                  <div className="text-2xl sm:text-3xl font-heading">{s.value}</div>
                  <div className="text-xs font-base opacity-70">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Not connected ── */}
      {!isConnected && (
        <div className="relative overflow-hidden flex-1 flex items-center justify-center p-6">
          <div aria-hidden className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-chart-1 opacity-[0.10] blur-[120px] pointer-events-none animate-blob" />
          <div aria-hidden className="absolute bottom-0 right-1/4 w-72 h-72 rounded-full bg-chart-5 opacity-[0.08] blur-[100px] pointer-events-none animate-blob blob-delay-2" />
          <div className="border-2 border-border rounded-base bg-secondary-background p-10 max-w-md w-full text-center shadow-[4px_4px_0px_0px_var(--border)]">
            <div className="text-5xl mb-5">🔗</div>
            <h2 className="font-heading text-2xl mb-2">Connect to browse</h2>
            <p className="text-muted-foreground font-base text-sm mb-8 max-w-xs mx-auto">
              Connect your wallet to browse, make offers, and purchase verified footage.
              The 5% journalism fund supports truth reporting worldwide.
            </p>
            <ConnectWallet />
            <div className="mt-6 pt-6 border-t-2 border-border flex justify-center gap-6 text-xs text-muted-foreground font-base">
              <span>🔒 Encrypted</span>
              <span>📡 Filecoin</span>
              <span>✓ On-chain proof</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Connected: filters + grid ── */}
      {isConnected && (
        <div className="relative overflow-hidden flex-1 flex flex-col">
          <div aria-hidden className="absolute -top-10 -right-10 w-80 h-80 rounded-full bg-chart-1 opacity-[0.08] blur-[120px] pointer-events-none animate-blob" />
          <div aria-hidden className="absolute bottom-10 -left-10 w-72 h-72 rounded-full bg-chart-2 opacity-[0.07] blur-[100px] pointer-events-none animate-blob blob-delay-2" />
          <div aria-hidden className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full bg-chart-5 opacity-[0.07] blur-[100px] pointer-events-none animate-blob blob-delay-3" />
          {/* Sticky filter bar */}
          <div className="sticky top-0 z-10 border-b-2 border-border bg-background py-3">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Search by title or location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sm:max-w-xs h-9 text-sm"
            />
            <div className="flex gap-2 overflow-x-auto pb-0.5 sm:pb-0 shrink-0">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`shrink-0 px-3 py-1.5 rounded-base border-2 border-border text-xs font-base font-medium transition-all duration-150
                    ${filter === f.key
                      ? "bg-main shadow-[2px_2px_0px_0px_var(--border)] -translate-y-px"
                      : "bg-secondary-background hover:bg-main/40"
                    }`}
                >
                  {f.label}
                </button>
              ))}
              {(search || filter !== "all") && (
                <button
                  onClick={() => { setSearch(""); setFilter("all"); }}
                  className="shrink-0 px-3 py-1.5 rounded-base border-2 border-border text-xs font-base text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            </div>
          </div>

          <div className="flex-1 px-4 sm:px-6 py-6 max-w-6xl mx-auto w-full">
            {/* Loading skeletons */}
            {loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="border-2 border-border rounded-base bg-secondary-background overflow-hidden animate-pulse"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="aspect-video bg-border/20" />
                    <div className="p-3 space-y-2">
                      <div className="h-4 bg-border/20 rounded w-3/4" />
                      <div className="h-3 bg-border/20 rounded w-1/2" />
                      <div className="h-3 bg-border/20 rounded w-2/3" />
                    </div>
                    <div className="px-3 pb-3 pt-2 border-t-2 border-border flex gap-2">
                      <div className="h-8 bg-border/20 rounded flex-1" />
                      <div className="h-8 bg-border/20 rounded flex-1" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Result count */}
            {!loading && (
              <p className="text-xs text-muted-foreground font-base mb-4">
                {filtered.length} clip{filtered.length !== 1 ? "s" : ""}
                {search && ` matching "${search}"`}
                {filter !== "all" && ` · ${FILTERS.find((f) => f.key === filter)?.label}`}
              </p>
            )}

            {/* Empty state */}
            {!loading && filtered.length === 0 && (
              <div className="border-2 border-dashed border-border rounded-base py-20 text-center">
                <span className="text-5xl block mb-4">📹</span>
                <p className="font-heading text-xl mb-2">
                  {search || filter !== "all" ? "No matching footage" : "No footage yet"}
                </p>
                <p className="text-muted-foreground font-base text-sm mb-6">
                  {search || filter !== "all"
                    ? "Try a different search or filter."
                    : "Be the first to publish verified footage."}
                </p>
                {filter === "all" && !search && (
                  <Link href="/record">
                    <Button>Start Recording →</Button>
                  </Link>
                )}
              </div>
            )}

            {/* Grid */}
            {!loading && filtered.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((r, i) => (
                  <MarketplaceCard
                    key={r.recording_id}
                    recording={r}
                    walletAddress={connectedAddress}
                    bids={bidsMap[r.recording_id] ?? []}
                    userHasBid={userBids.has(r.recording_id)}
                    isBuying={buying === r.recording_id}
                    onBuy={handleBuy}
                    onBid={handleOpenBid}
                    stagger={Math.min(i % 6, 5) as 0 | 1 | 2 | 3 | 4 | 5}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Offer dialog ── */}
      <Dialog open={!!bidTarget} onOpenChange={(open) => !open && setBidTarget(null)}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Make an Offer</DialogTitle>
            <DialogDescription className="font-base text-sm">
              Offer a price for &ldquo;{bidTarget?.title || "Untitled"}&rdquo;.
              Your tFIL is held in escrow — the witness accepts or rejects.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 pt-1">
            {/* Price info */}
            <div className="bg-secondary-background border-2 border-border rounded-base px-4 py-3 flex flex-col gap-1 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Asking price</span>
                <span className="font-heading">
                  {((Number(bidTarget?.price_eth ?? "0")) / 1e18).toFixed(4)} tFIL
                </span>
              </div>
              {bidTarget && (bidsMap[bidTarget.recording_id]?.filter((b) => b.status === "Pending").length ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active offers</span>
                  <span className="font-heading">
                    {bidsMap[bidTarget.recording_id].filter((b) => b.status === "Pending").length}
                  </span>
                </div>
              )}
              {bidTarget && highestPending(bidsMap[bidTarget.recording_id] ?? []) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Top offer</span>
                  <span className="font-heading text-[#0099FF]">
                    {(Number(highestPending(bidsMap[bidTarget.recording_id] ?? [])?.amount ?? "0") / 1e18).toFixed(4)} tFIL
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-base text-muted-foreground mb-1.5 block">
                Your offer (tFIL)
              </label>
              <Input
                type="number"
                step="0.0001"
                min="0.0001"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder="0.0005"
                className="text-base"
              />
              <p className="text-xs text-muted-foreground font-base mt-1.5">
                Refunded automatically if rejected
              </p>
            </div>

            <div className="flex gap-2 pt-1">
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
