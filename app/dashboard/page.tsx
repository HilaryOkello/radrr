"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { ConnectWallet } from "@/components/ConnectWallet";
import { FootageCard, type FootageRecording } from "@/components/FootageCard";
import { HypercertsList, type HypercertEntry } from "@/components/HypercertsList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Identity {
  pseudonym: string;
  credibility_score: number;
  recording_count: number;
  total_sales: number;
}

interface SerializedBid {
  index: number;
  bidder: string;
  amount: string; // wei
  timestamp: number;
  status: string;
}

interface RecordingBids {
  recording: FootageRecording;
  bids: SerializedBid[];
}

interface BuyerBid {
  index: number;
  recording_id: string;
  title: string;
  amount: string;
  timestamp: number;
  status: string;
}

export default function DashboardPage() {
  const { address: connectedAddress } = useAccount();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [recordings, setRecordings] = useState<FootageRecording[]>([]);
  const [purchasedRecordings, setPurchasedRecordings] = useState<FootageRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [recordingBids, setRecordingBids] = useState<RecordingBids[]>([]);
  const [buyerBids, setBuyerBids] = useState<BuyerBid[]>([]);
  const [mintedHypercerts, setMintedHypercerts] = useState<HypercertEntry[]>([]);
  const [ownedHypercerts, setOwnedHypercerts] = useState<HypercertEntry[]>([]);
  const [actioning, setActioning] = useState<string | null>(null); // "recordingId-bidIndex"

  useEffect(() => {
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
      const [identityRes, recordingsRes, purchasedRes, buyerBidsRes] = await Promise.all([
        fetch(`/api/identity?accountId=${accountId}`),
        fetch(`/api/recordings?witness=${accountId}`),
        fetch(`/api/recordings?buyer=${accountId}`),
        fetch(`/api/bids/by-bidder?bidder=${accountId}`),
      ]);

      if (identityRes.ok) {
        const data = await identityRes.json();
        setIdentity(data.identity);
      }
      if (recordingsRes.ok) {
        const data = await recordingsRes.json();
        const recs: FootageRecording[] = data.recordings ?? [];
        setRecordings(recs);

        // Fetch bids for all unsold recordings
        const bidsResults = await Promise.all(
          recs
            .filter((r) => !r.sold)
            .map((r) =>
              fetch(`/api/bids?recordingId=${r.recording_id}`)
                .then((res) => res.json())
                .then((d) => ({ recording: r, bids: (d.bids ?? []) as SerializedBid[] }))
                .catch(() => ({ recording: r, bids: [] as SerializedBid[] }))
            )
        );
        setRecordingBids(bidsResults.filter((rb) => rb.bids.length > 0));
      }
      if (purchasedRes.ok) {
        const data = await purchasedRes.json();
        const purchased: FootageRecording[] = data.recordings ?? [];
        setPurchasedRecordings(purchased);
      }
      if (buyerBidsRes.ok) {
        const data = await buyerBidsRes.json();
        setBuyerBids(data.bids ?? []);
      }

      const [mintedRes, ownedRes] = await Promise.all([
        fetch(`/api/hypercerts/by-owner/${accountId}?role=minted`),
        fetch(`/api/hypercerts/by-owner/${accountId}?role=owned`),
      ]);
      if (mintedRes.ok) {
        const data = await mintedRes.json();
        setMintedHypercerts(data.hypercerts ?? []);
      }
      if (ownedRes.ok) {
        const data = await ownedRes.json();
        setOwnedHypercerts(data.hypercerts ?? []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptBid(recordingId: string, bidIndex: number) {
    if (!walletAddress) return;
    const key = `${recordingId}-${bidIndex}`;
    setActioning(key);
    try {
      const res = await fetch("/api/bids/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingId, bidIndex, witness: walletAddress }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast.success("🎉 Sale complete! 85% transferred to you, 5% to journalism fund.");
      // Update local state
      setRecordingBids((prev) =>
        prev.map((rb) =>
          rb.recording.recording_id === recordingId
            ? {
                ...rb,
                bids: rb.bids.map((b, i) =>
                  i === bidIndex
                    ? { ...b, status: "Accepted" }
                    : b.status === "Pending"
                    ? { ...b, status: "Rejected" }
                    : b
                ),
              }
            : rb
        )
      );
      setRecordings((prev) =>
        prev.map((r) =>
          r.recording_id === recordingId ? { ...r, sold: true } : r
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to accept bid");
    } finally {
      setActioning(null);
    }
  }

  async function handleRejectBid(recordingId: string, bidIndex: number) {
    if (!walletAddress) return;
    const key = `${recordingId}-${bidIndex}`;
    setActioning(key);
    try {
      const res = await fetch("/api/bids/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingId, bidIndex, witness: walletAddress }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast.info("Bid rejected. Bidder has been refunded.");
      setRecordingBids((prev) =>
        prev.map((rb) =>
          rb.recording.recording_id === recordingId
            ? {
                ...rb,
                bids: rb.bids.map((b, i) =>
                  i === bidIndex ? { ...b, status: "Rejected" } : b
                ),
              }
            : rb
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject bid");
    } finally {
      setActioning(null);
    }
  }

  const totalPendingBids = recordingBids.reduce(
    (sum, rb) => sum + rb.bids.filter((b) => b.status === "Pending").length,
    0
  );

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
                  <Stat label="Credibility" value={String(identity?.credibility_score ?? "—")} highlight={credibilityColor} />
                  <Stat label="Recordings" value={String(identity?.recording_count ?? recordings.length)} />
                  <Stat label="Sales" value={String(identity?.total_sales ?? "—")} />
                  <Stat label="Identity" value="ERC-8004" highlight="bg-chart-5 text-white" />
                </CardContent>
              </Card>

              <Card className="border-2 border-border">
                <CardContent className="pt-6 flex flex-col gap-3">
                  <Link href="/record" className="block">
                    <Button className="w-full">New Recording</Button>
                  </Link>
                  <Link href="/marketplace" className="block">
                    <Button variant="neutral" className="w-full">Browse Marketplace</Button>
                  </Link>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
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
                  <TabsTrigger value="bids" className="relative">
                    Offers
                    {totalPendingBids > 0 && (
                      <Badge className="ml-1 bg-main text-black text-xs px-1 py-0 h-4 min-w-4">
                        {totalPendingBids}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="my-bids">
                    My Bids ({buyerBids.filter(b => b.status === "Pending").length})
                  </TabsTrigger>
                  <TabsTrigger value="purchased">
                    Purchased ({purchasedRecordings.length})
                  </TabsTrigger>
                  <TabsTrigger value="hypercerts">
                    Hypercerts
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
              <TabsContent value="bids">
                <BidsList
                  recordingBids={recordingBids}
                  actioning={actioning}
                  onAccept={handleAcceptBid}
                  onReject={handleRejectBid}
                />
              </TabsContent>
              <TabsContent value="my-bids">
                <BuyerBidsList bids={buyerBids} />
              </TabsContent>
              <TabsContent value="purchased">
                <PurchasedList recordings={purchasedRecordings} walletAddress={walletAddress ?? undefined} />
              </TabsContent>
              <TabsContent value="hypercerts">
                <div className="flex flex-col gap-6">
                  <div>
                    <h3 className="font-heading text-lg mb-3">Minted by you</h3>
                    <HypercertsList
                      hypercerts={mintedHypercerts}
                      emptyMessage="No hypercerts minted yet. When your footage sells, a hypercert is minted to record the impact."
                    />
                  </div>
                  <div>
                    <h3 className="font-heading text-lg mb-3">Owned</h3>
                    <HypercertsList
                      hypercerts={ownedHypercerts}
                      emptyMessage="No hypercerts owned. When you buy footage, you receive a hypercert as proof of your impact contribution."
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground font-base">{label}</span>
      <span className={`text-2xl font-heading px-1 inline-block ${highlight ?? ""}`}>{value}</span>
    </div>
  );
}

function RecordingsList({ recordings, walletAddress }: { recordings: FootageRecording[]; walletAddress?: string }) {
  if (recordings.length === 0) {
    return (
      <Card className="border-2 border-border">
        <CardContent className="py-12 text-center text-muted-foreground font-base">
          No recordings yet.{" "}
          <Link href="/record" className="underline">Start recording</Link>.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {recordings.map((r) => (
        <div key={r.recording_id} className="flex flex-col gap-2">
          <FootageCard recording={r} mode="dashboard" walletAddress={walletAddress} />
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="neutral" className="bg-secondary-background">
              {r.visibility_level === "full" ? "Public" : r.visibility_level === "trailer" ? "Trailer" : r.visibility_level === "thumbnail" ? "Thumbnail" : "Blurred"}
            </Badge>
            <Badge variant="neutral" className="bg-secondary-background">
              {r.license_type === "non_exclusive" ? "Non-Exclusive" : r.license_type === "personal" ? "Personal" : r.license_type === "editorial" ? "Editorial" : r.license_type === "commercial" ? "Commercial" : "CC BY"}
            </Badge>
            {r.trailer_cid && <Badge variant="neutral" className="bg-green-900/30 text-green-400">Trailer ✓</Badge>}
            {!r.trailer_cid && r.visibility_level !== "full" && r.visibility_level !== "thumbnail" && (
              <Badge variant="neutral" className="bg-yellow-900/30 text-yellow-400">No trailer</Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function BidsList({
  recordingBids,
  actioning,
  onAccept,
  onReject,
}: {
  recordingBids: RecordingBids[];
  actioning: string | null;
  onAccept: (recordingId: string, bidIndex: number) => void;
  onReject: (recordingId: string, bidIndex: number) => void;
}) {
  const allBids = recordingBids.flatMap((rb) =>
    rb.bids.map((bid) => ({ ...bid, recording: rb.recording }))
  );

  if (allBids.length === 0) {
    return (
      <Card className="border-2 border-border">
        <CardContent className="py-12 text-center text-muted-foreground font-base">
          No offers yet. Share your footage on the marketplace to attract buyers.
        </CardContent>
      </Card>
    );
  }

  const statusColor: Record<string, string> = {
    Pending: "bg-main text-black",
    Accepted: "bg-chart-2 text-black",
    Rejected: "bg-muted text-muted-foreground",
    Withdrawn: "bg-muted text-muted-foreground",
  };

  return (
    <div className="flex flex-col gap-3">
      {allBids.map((bid) => {
        const key = `${bid.recording.recording_id}-${bid.index}`;
        const isActioning = actioning === key;
        const amountTFIL = (Number(bid.amount) / 1e18).toFixed(4);
        const date = new Date(bid.timestamp * 1000).toLocaleString(undefined, {
          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        });

        return (
          <Card key={key} className="border-2 border-border">
            <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="font-heading text-sm line-clamp-1">
                  {bid.recording.title || "Untitled Recording"}
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  From: {bid.bidder.slice(0, 10)}…{bid.bidder.slice(-6)}
                </div>
                <div className="text-xs text-muted-foreground font-base">{date}</div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-heading text-lg">{amountTFIL} tFIL</div>
                  <Badge className={`text-xs ${statusColor[bid.status] ?? ""}`}>
                    {bid.status}
                  </Badge>
                </div>

                {bid.status === "Pending" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="neutral"
                      disabled={!!isActioning}
                      onClick={() => onReject(bid.recording.recording_id, bid.index)}
                    >
                      {isActioning ? "…" : "Reject"}
                    </Button>
                    <Button
                      size="sm"
                      disabled={!!isActioning}
                      onClick={() => onAccept(bid.recording.recording_id, bid.index)}
                    >
                      {isActioning ? "…" : "Accept"}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function PurchasedList({ recordings, walletAddress }: { recordings: FootageRecording[]; walletAddress?: string }) {
  if (recordings.length === 0) {
    return (
      <Card className="border-2 border-border">
        <CardContent className="py-12 text-center text-muted-foreground font-base">
          No purchases yet.{" "}
          <Link href="/marketplace" className="underline">Browse the marketplace</Link> to find footage.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {recordings.map((r) => (
        <div key={r.recording_id} className="flex flex-col gap-2">
          <FootageCard recording={r} mode="dashboard" walletAddress={walletAddress} />
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="neutral" className="bg-chart-2/20 text-chart-2 border-chart-2">
              Purchased
            </Badge>
            <Badge variant="neutral" className="bg-secondary-background">
              {r.license_type === "non_exclusive" ? "Non-Exclusive" : r.license_type === "personal" ? "Personal" : r.license_type === "editorial" ? "Editorial" : r.license_type === "commercial" ? "Commercial" : "CC BY"}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

function BuyerBidsList({ bids }: { bids: BuyerBid[] }) {
  if (bids.length === 0) {
    return (
      <Card className="border-2 border-border">
        <CardContent className="py-12 text-center text-muted-foreground font-base">
          No bids placed yet.{" "}
          <Link href="/marketplace" className="underline">Browse the marketplace</Link> to find footage.
        </CardContent>
      </Card>
    );
  }

  const statusColor: Record<string, string> = {
    Pending: "bg-main text-black",
    Accepted: "bg-chart-2 text-black",
    Rejected: "bg-red-900/30 text-red-400",
    Withdrawn: "bg-muted text-muted-foreground",
  };

  return (
    <div className="flex flex-col gap-3">
      {bids.map((bid) => {
        const key = `${bid.recording_id}-${bid.index}`;
        const amountTFIL = (Number(bid.amount) / 1e18).toFixed(4);
        const date = new Date(bid.timestamp * 1000).toLocaleString(undefined, {
          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        });

        return (
          <Card key={key} className="border-2 border-border">
            <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex flex-col gap-1 min-w-0">
                <div className="font-heading text-sm line-clamp-1">
                  {bid.title || "Untitled Recording"}
                </div>
                <div className="text-xs text-muted-foreground font-base">{date}</div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-heading text-lg">{amountTFIL} tFIL</div>
                  <Badge className={`text-xs ${statusColor[bid.status] ?? ""}`}>
                    {bid.status}
                  </Badge>
                </div>

                {bid.status === "Pending" && (
                  <Link href={`/recording/${bid.recording_id}`}>
                    <Button size="sm" variant="neutral">
                      View
                    </Button>
                  </Link>
                )}
                {bid.status === "Accepted" && (
                  <Link href={`/recording/${bid.recording_id}`}>
                    <Button size="sm">
                      Watch 🎉
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
