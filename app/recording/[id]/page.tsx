"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAccount, useSendTransaction } from "wagmi";
import { createPublicClient, http, encodeFunctionData } from "viem";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import type { FootageRecording } from "@/components/FootageCard";
import { useLocationName } from "@/hooks/useLocationName";
import { toast } from "sonner";
import { filecoinCalibration } from "viem/chains";

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
  const { sendTransactionAsync } = useSendTransaction();
  const [recording, setRecording] = useState<FootageRecording | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoError, setVideoError] = useState(false);

  // Similarity data for verification section - must be before any early returns
  const [similarityData, setSimilarityData] = useState<{
    totalMatches: number;
    matches: Array<{
      recordingId: string;
      similarityScore: number;
      metadataMatch: boolean;
      method: string;
    }>;
    metadataThresholds: {
      timeWindow: string;
      gpsPrecision: string;
      visualThreshold: string;
    };
  } | null>(null);

  const locationName = useLocationName(recording?.gps_approx);

  const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_FILECOIN_CONTRACT_ADDRESS as `0x${string}`;
  // price_eth is stored as wei, so use directly
  const PRICE_WEI = recording?.price_eth ? BigInt(recording.price_eth) : BigInt(0);

  const RADRR_PURCHASE_ABI = [{
    type: "function",
    name: "purchase",
    stateMutability: "payable",
    inputs: [{ name: "recordingId", type: "string" }],
    outputs: [],
  }] as const;

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

  // Fetch similarity data for verification section
  useEffect(() => {
    if (!recording) return;
    fetch(`/api/recordings/${recording.recording_id}/similarity`)
      .then((r) => r.json())
      .then((data) => setSimilarityData(data))
      .catch(console.error);
  }, [recording]);

  async function handleBuy() {
    if (!connectedAddress) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!recording) return;

    setBuying(true);
    try {
      // First check if already purchased (e.g., via bid acceptance)
      toast.info("Checking purchase status...");
      const checkRes = await fetch("/api/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordingId: recording.recording_id,
          buyerAddress: connectedAddress,
        }),
      });

      const checkData = await checkRes.json();

      if (checkData.alreadyPurchased) {
        // Already purchased via bid - no transaction needed
        toast.success("Content purchased via offer! Decrypting...", { position: "top-center" });
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

        // Send transaction via MetaMask (wallet)
        const hash = await sendTransactionAsync({
          to: CONTRACT_ADDRESS,
          data,
          value: PRICE_WEI,
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
          body: JSON.stringify({
            recordingId: recording.recording_id,
            buyerAddress: connectedAddress,
          }),
        });

        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
          throw new Error(verifyData.error || "Purchase verification failed");
        }
      }

      // At this point, purchase is confirmed (either via bid or direct purchase)
      toast.success("🎉 Footage purchased — you own this", { position: "top-center" });
      setRecording((prev) => prev ? { ...prev, sold: true } : null);

      // Fetch and decrypt the video
      if (checkData.encryptedCid) {
        toast.info("Fetching encrypted video...");
        const encryptedRes = await fetch(ipfsUrl(checkData.encryptedCid));
        if (!encryptedRes.ok) {
          throw new Error("Failed to fetch encrypted video");
        }
        const encryptedData = await encryptedRes.json();

        // Use keyCid from purchase data (stored on-chain)
        const keyCid = checkData.keyCid;
        if (!keyCid) {
          throw new Error("Encryption key CID not found");
        }

        // Fetch the XOR-encrypted key from IPFS
        toast.info("Fetching encryption key...");
        const keyDataRes = await fetch(`https://${keyCid}.ipfs.w3s.link`);
        if (!keyDataRes.ok) {
          throw new Error("Failed to fetch encryption key from IPFS");
        }
        const { encryptedKey } = await keyDataRes.json();

        // Decrypt video client-side (XOR-decrypt key, then decrypt video)
        toast.info("Decrypting video...");
        const { decryptVideoClientSide } = await import("@/lib/encryption-client");
        const decryptedBytes = await decryptVideoClientSide(
          encryptedData.ciphertext,
          encryptedData.iv,
          encryptedKey
        );

        // Create blob URL and play
        const blob = new Blob([decryptedBytes], { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setVideoSrc(url);
        toast.success("Video decrypted and ready!", { position: "top-center" });
      }
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

      <div className="relative flex-1 p-6 max-w-4xl mx-auto w-full">
        <div aria-hidden className="absolute inset-0 bg-dot-pattern opacity-[0.04] pointer-events-none" />
        <div aria-hidden className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-chart-1 opacity-[0.09] blur-[120px] pointer-events-none animate-blob" />
        <div aria-hidden className="absolute bottom-10 -left-10 w-64 h-64 rounded-full bg-chart-5 opacity-[0.08] blur-[100px] pointer-events-none animate-blob blob-delay-2" />
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
                    {locationName && <p>{locationName}</p>}
                    <p className="font-mono text-xs text-muted-foreground">{recording.gps_approx}</p>
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

                {recording.corroboration_bundle.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-muted-foreground font-base">Corroborating recordings:</p>
                    <div className="flex flex-wrap gap-2">
                      {recording.corroboration_bundle.map((id) => (
                        <Link
                          key={id}
                          href={`/recording/${id}`}
                          className="font-mono text-xs text-[#0099FF] hover:underline border border-border rounded px-2 py-0.5 bg-background"
                        >
                          {id}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Verification Section */}
            {similarityData && similarityData.totalMatches > 0 && (
              <Card className="border-2 border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Badge className="bg-chart-5 text-white">✓ Verified</Badge>
                    <span>Corroboration Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Matched with {similarityData.totalMatches} video{similarityData.totalMatches > 1 ? 's' : ''} using location, time, and visual similarity.
                  </p>

                  <div className="space-y-3">
                    {similarityData.matches.slice(0, 5).map((match) => (
                      <div key={match.recordingId} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{match.recordingId.slice(0, 20)}...</p>
                          <p className="text-xs text-muted-foreground">
                            {match.metadataMatch ? "GPS+Time matched" : "Visual match"}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-chart-5">
                            {Math.round(match.similarityScore * 100)}%
                          </div>
                          <div className="text-xs text-muted-foreground">similarity</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {similarityData.totalMatches > 5 && (
                    <p className="text-xs text-muted-foreground text-center mt-3">
                      +{similarityData.totalMatches - 5} more matches
                    </p>
                  )}

                  <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
                    <p className="font-medium mb-1">Verification method:</p>
                    <ul className="space-y-1">
                      <li>• GPS proximity: {similarityData.metadataThresholds.gpsPrecision}</li>
                      <li>• Time window: {similarityData.metadataThresholds.timeWindow}</li>
                      <li>• Visual similarity: ≥{similarityData.metadataThresholds.visualThreshold}</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

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
