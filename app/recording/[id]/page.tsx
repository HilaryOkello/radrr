"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import type { FootageRecording } from "@/components/FootageCard";
import { toast } from "sonner";

function ipfsUrl(cid: string) {
  return `https://${cid}.ipfs.w3s.link`;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString();
}

function formatEth(wei: string) {
  return (Number(wei) / 1e18).toFixed(4);
}

const LICENSE_LABELS: Record<string, string> = {
  non_exclusive: "Non-Exclusive",
  personal: "Personal Use",
  editorial: "Editorial Use",
  commercial: "Commercial License",
  cc_by: "CC BY",
};

const VISIBILITY_LABELS: Record<string, string> = {
  full: "Public",
  trailer: "Trailer Only",
  thumbnail: "Thumbnail Only",
  blur: "Blurred",
};

export default function RecordingDetailPage() {
  const params = useParams();
  const recordingId = params.id as string;
  const { address: connectedAddress, isConnected } = useAccount();
  const [recording, setRecording] = useState<FootageRecording | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    fetch(`/api/recordings`)
      .then((r) => r.json())
      .then((d) => {
        const recs: FootageRecording[] = d.recordings ?? [];
        const found = recs.find((r) => r.recording_id === recordingId);
        setRecording(found ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [recordingId]);

  useEffect(() => {
    if (!recording) return;
    
    const visibility = recording.visibility_level ?? "blur";
    const isOwner = connectedAddress?.toLowerCase() === recording.witness?.toLowerCase();

    setVideoError(false);
    if (isOwner) {
      setVideoSrc(recording.cid ? ipfsUrl(recording.cid) : null);
    } else if (visibility === "full") {
      setVideoSrc(recording.cid ? ipfsUrl(recording.cid) : null);
    } else if (visibility === "trailer" && recording.trailer_cid) {
      setVideoSrc(ipfsUrl(recording.trailer_cid));
    } else {
      setVideoSrc(null);
    }
  }, [recording, connectedAddress]);

  async function handleBuy() {
    if (!connectedAddress) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!recording) return;

    setBuying(true);
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

      toast.success("🎉 Footage purchased — you own this", { position: "top-center" });
      setRecording((prev) => prev ? { ...prev, sold: true } : null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setBuying(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground font-base animate-pulse">Loading...</div>
        </div>
      </main>
    );
  }

  if (!recording) {
    return (
      <main className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Card className="border-2 border-border max-w-md">
            <CardContent className="py-12 text-center">
              <div className="text-5xl mb-4">🔍</div>
              <p className="font-heading text-xl mb-4">Recording not found</p>
              <Link href="/marketplace">
                <Button>Browse Marketplace</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const visibility = recording.visibility_level ?? "blur";
  const isOwner = connectedAddress?.toLowerCase() === recording.witness?.toLowerCase();
  const canWatch = isOwner || visibility === "full" || (visibility === "trailer" && recording.trailer_cid);

  return (
    <main className="min-h-screen flex flex-col">
      <Navbar />

      <div className="flex-1 p-6 max-w-4xl mx-auto w-full">
        {/* Video Player */}
        <div className="relative bg-black aspect-video rounded-base overflow-hidden mb-6 border-2 border-border">
          {canWatch && videoSrc && !videoError ? (
            <video
              src={videoSrc}
              poster={recording.preview_cid ? ipfsUrl(recording.preview_cid) : undefined}
              className="w-full h-full object-contain"
              controls
              muted={visibility === "trailer"}
              loop={visibility === "trailer"}
              onError={() => setVideoError(true)}
            />
          ) : videoError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary-background">
              <span className="text-5xl opacity-30">⚠️</span>
              <p className="text-muted-foreground font-base mt-4">Video could not be loaded</p>
              <p className="text-muted-foreground font-base text-sm mt-1">The file may be corrupted or still propagating on IPFS</p>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary-background">
              {recording.preview_cid ? (
                <img
                  src={ipfsUrl(recording.preview_cid)}
                  alt={recording.title}
                  className="w-full h-full object-contain"
                />
              ) : (
                <>
                  <span className="text-5xl opacity-30">📹</span>
                  <p className="text-muted-foreground font-base mt-4">Preview unavailable</p>
                </>
              )}
              {visibility === "blur" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <span className="text-white/50 font-heading text-2xl">Purchase to watch</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="md:col-span-2 space-y-4">
            <Card className="border-2 border-border">
              <CardHeader>
                <CardTitle className="text-2xl">{recording.title || "Untitled Recording"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {recording.description && (
                  <p className="text-muted-foreground font-base">{recording.description}</p>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Location</span>
                    <p className="font-mono">{recording.gps_approx}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Recorded</span>
                    <p>{formatDate(recording.timestamp)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {recording.corroboration_bundle.length > 0 && (
                    <Badge className="bg-chart-5 text-white">
                      ✓ Corroborated ×{recording.corroboration_bundle.length}
                    </Badge>
                  )}
                  <Badge variant="neutral">FVM Anchored</Badge>
                  <Badge variant="neutral">Filecoin</Badge>
                </div>
              </CardContent>
            </Card>

            {/* License */}
            <Card className="border-2 border-border">
              <CardHeader>
                <CardTitle className="text-base">License</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-heading text-lg">{LICENSE_LABELS[recording.license_type ?? "non_exclusive"] ?? recording.license_type}</p>
                <p className="text-sm text-muted-foreground font-base mt-1">
                  {recording.license_type === "personal" && "Buyer cannot redistribute"}
                  {recording.license_type === "editorial" && "News/media can use with attribution"}
                  {recording.license_type === "commercial" && "Full commercial usage rights"}
                  {recording.license_type === "cc_by" && "Creative Commons, attribution required"}
                  {recording.license_type === "non_exclusive" && "Witness keeps rights, can sell to multiple buyers"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Witness */}
            <Card className="border-2 border-border">
              <CardHeader>
                <CardTitle className="text-base">Witness</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-sm truncate">{recording.witness}</p>
                {isOwner && <Badge className="mt-2 bg-main text-black">This is you</Badge>}
              </CardContent>
            </Card>

            {/* Price / Buy */}
            {!isOwner && (
              <Card className="border-2 border-border">
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <span className="text-muted-foreground text-sm">Price</span>
                    <p className="font-heading text-3xl">{formatEth(recording.price_eth)} tFIL</p>
                  </div>

                  {recording.sold ? (
                    <Badge className="bg-chart-2 text-black w-full justify-center">Sold</Badge>
                  ) : (
                    <Button
                      size="lg"
                      className="w-full"
                      onClick={handleBuy}
                      disabled={buying || !isConnected}
                    >
                      {buying ? "Processing..." : isConnected ? "Buy Now" : "Connect Wallet to Buy"}
                    </Button>
                  )}

                  <p className="text-xs text-muted-foreground font-base text-center">
                    85% to witness · 5% journalism fund
                  </p>
                </CardContent>
              </Card>
            )}

            {isOwner && (
              <Card className="border-2 border-border">
                <CardContent className="pt-6">
                  <Badge className="bg-main text-black w-full justify-center mb-4">Your Recording</Badge>
                  {recording.cid && (
                    <a href={ipfsUrl(recording.cid)} target="_blank" rel="noopener noreferrer" className="block">
                      <Button variant="neutral" className="w-full">View Original ↗</Button>
                    </a>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Technical */}
            <Card className="border-2 border-border">
              <CardHeader>
                <CardTitle className="text-base">Technical Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs font-mono">
                <div>
                  <span className="text-muted-foreground">ID: </span>
                  <span className="truncate">{recording.recording_id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Merkle: </span>
                  <span className="truncate">{recording.merkle_root.slice(0, 20)}...</span>
                </div>
                {recording.cid && (
                  <div>
                    <span className="text-muted-foreground">CID: </span>
                    <span className="truncate">{recording.cid.slice(0, 20)}...</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
