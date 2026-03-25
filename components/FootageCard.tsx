"use client";

import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface FootageRecording {
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
  return (Number(wei) / 1e18).toFixed(4);
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ipfsUrl(cid: string) {
  return `https://${cid}.ipfs.w3s.link`;
}

interface FootageCardProps {
  recording: FootageRecording;
  /** "marketplace" shows buy button; "dashboard" shows owner actions */
  mode: "marketplace" | "dashboard";
  /** Connected wallet — used to determine if this user is the witness */
  walletAddress?: string;
  onBuy?: (r: FootageRecording) => void;
  isBuying?: boolean;
}

export function FootageCard({
  recording: r,
  mode,
  walletAddress,
  onBuy,
  isBuying = false,
}: FootageCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [thumbLoaded, setThumbLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);

  const isOwner = walletAddress?.toLowerCase() === r.witness?.toLowerCase();
  const videoSrc = r.cid ? ipfsUrl(r.cid) : null;
  // Blur for marketplace non-owners who haven't purchased
  const blurred = mode === "marketplace" && !isOwner;

  function handleMouseEnter() {
    if (!videoRef.current || !videoSrc) return;
    videoRef.current.play().catch(() => {});
    setPlaying(true);
  }

  function handleMouseLeave() {
    if (!videoRef.current) return;
    videoRef.current.pause();
    videoRef.current.currentTime = 0;
    setPlaying(false);
  }

  return (
    <Card className="border-2 border-border flex flex-col overflow-hidden">
      {/* Thumbnail / Video preview */}
      <div
        className="relative bg-black aspect-video border-b-2 border-border overflow-hidden cursor-pointer group"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {videoSrc ? (
          <>
            <video
              ref={videoRef}
              src={videoSrc}
              className={`w-full h-full object-cover transition-all duration-300 ${
                blurred ? "blur-md scale-110" : ""
              }`}
              preload="metadata"
              muted
              loop
              playsInline
              onLoadedMetadata={() => setThumbLoaded(true)}
            />
            {/* Hover play indicator */}
            {!playing && thumbLoaded && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white ml-1" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.841z" />
                  </svg>
                </div>
              </div>
            )}
            {/* Blur overlay for marketplace */}
            {blurred && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30">
                <span className="text-white font-heading text-sm">🔒 Purchase to unlock</span>
              </div>
            )}
            {/* No CID yet */}
            {!thumbLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-secondary-background">
                <span className="text-4xl opacity-30">📹</span>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary-background">
            <span className="text-4xl opacity-30">📹</span>
            <span className="text-xs text-muted-foreground font-base mt-2">Processing…</span>
          </div>
        )}

        {/* Status badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {r.corroboration_bundle.length > 0 && (
            <Badge className="bg-chart-5 text-white text-xs">
              ✓ Corroborated ×{r.corroboration_bundle.length}
            </Badge>
          )}
          {r.sold && (
            <Badge className="bg-chart-2 text-black text-xs">Sold</Badge>
          )}
          {isOwner && mode === "marketplace" && (
            <Badge className="bg-main text-black text-xs">Yours</Badge>
          )}
        </div>

        {/* Duration / recording indicator */}
        {r.encrypted_cid && (
          <div className="absolute bottom-2 right-2">
            <Badge variant="neutral" className="text-xs bg-black/70 text-white border-0">
              🔐 Encrypted
            </Badge>
          </div>
        )}
      </div>

      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base leading-snug line-clamp-1">
          {r.title || "Untitled Recording"}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 flex-1 pt-0">
        {/* Metadata */}
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-muted-foreground font-mono">
          <span>📍 {r.gps_approx}</span>
          <span>🕐 {formatDate(r.timestamp)}</span>
          <span className="col-span-2 truncate opacity-70">
            {r.merkle_root.slice(0, 28)}…
          </span>
        </div>

        {/* Proof badges */}
        <div className="flex flex-wrap gap-1">
          <Badge variant="neutral" className="text-xs">FVM Anchored</Badge>
          {r.cid && <Badge variant="neutral" className="text-xs">Filecoin</Badge>}
        </div>

        {/* Footer action */}
        <div className="mt-auto pt-3 border-t-2 border-border flex items-center justify-between gap-2">
          <div>
            <div className="font-heading text-lg">{formatEth(r.price_eth)} tFIL</div>
            {mode === "marketplace" && (
              <div className="text-xs text-muted-foreground font-base">85% to witness</div>
            )}
            {mode === "dashboard" && (
              <div className="text-xs text-muted-foreground font-base">
                {r.sold ? "Sold" : "Available"}
              </div>
            )}
          </div>

          {mode === "marketplace" && !r.sold && !isOwner && (
            <Button size="sm" onClick={() => onBuy?.(r)} disabled={isBuying}>
              {isBuying ? "Buying…" : "Buy Now"}
            </Button>
          )}
          {mode === "marketplace" && r.sold && (
            <Badge className="bg-chart-2 text-black">Sold</Badge>
          )}
          {mode === "dashboard" && r.cid && (
            <a href={ipfsUrl(r.cid)} target="_blank" rel="noopener noreferrer">
              <Button variant="neutral" size="sm">View ↗</Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
