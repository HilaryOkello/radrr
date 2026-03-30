"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type VisibilityLevel = "blur" | "trailer" | "thumbnail" | "full";
export type LicenseType = "personal" | "editorial" | "commercial" | "cc_by" | "non_exclusive";

export interface FootageRecording {
  recording_id: string;
  title: string;
  description?: string;
  gps_approx: string;
  timestamp: number;
  price_eth: string;
  sold: boolean;
  cid?: string;
  encrypted_cid?: string;
  key_cid?: string;
  preview_cid?: string;
  trailer_cid?: string;
  visibility_level?: VisibilityLevel;
  license_type?: LicenseType;
  witness: string;
  corroboration_bundle: string[];
  merkle_root: string;
}

function getVisibilityBadge(level: VisibilityLevel): { label: string; className: string } {
  switch (level) {
    case "full": return { label: "Public", className: "bg-green-600 text-white" };
    case "trailer": return { label: "Trailer", className: "bg-blue-600 text-white" };
    case "thumbnail": return { label: "Preview", className: "bg-yellow-600 text-black" };
    case "blur": return { label: "Blurred", className: "bg-gray-600 text-white" };
    default: return { label: "Unknown", className: "bg-gray-400 text-black" };
  }
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
  mode: "marketplace" | "dashboard";
  walletAddress?: string;
  onBuy?: (r: FootageRecording) => void;
  isBuying?: boolean;
  onBid?: (r: FootageRecording) => void;
  highestBid?: string;
  bidCount?: number;
}

export function FootageCard({
  recording: r,
  mode,
  walletAddress,
  onBuy,
  isBuying = false,
  onBid,
  highestBid,
  bidCount = 0,
}: FootageCardProps) {
  const isOwner = walletAddress?.toLowerCase() === r.witness?.toLowerCase();
  const visibilityLevel = r.visibility_level ?? "blur";

  return (
    <Card className="border-2 border-border flex flex-col overflow-hidden">
      {/* Thumbnail - Static Image */}
      <div className="relative bg-black aspect-video border-b-2 border-border overflow-hidden">
        {r.preview_cid ? (
          <img
            src={ipfsUrl(r.preview_cid)}
            alt={r.title || "Recording thumbnail"}
            className="w-full h-full object-cover"
          />
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
          {mode === "marketplace" && visibilityLevel === "full" && !isOwner && (
            <Badge className={getVisibilityBadge("full").className + " text-xs"}>Public</Badge>
          )}
        </div>

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
        {r.description && (
          <p className="text-xs text-muted-foreground font-base line-clamp-2 mt-1">{r.description}</p>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-3 flex-1 pt-0">
        {/* Metadata */}
        <div className="flex flex-col gap-1 text-xs text-muted-foreground font-mono">
          <div className="flex gap-3 flex-wrap">
            <span>📍 {r.gps_approx}</span>
            <span>🕐 {formatDate(r.timestamp)}</span>
          </div>
          <span className="truncate opacity-70">
            Witness: {r.witness.slice(0, 10)}…{r.witness.slice(-6)}
          </span>
          <span className="truncate opacity-50">
            Root: {r.merkle_root.slice(0, 24)}…
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
            {mode === "marketplace" && bidCount > 0 && (
              <div className="text-xs text-muted-foreground font-base">
                {bidCount} bid{bidCount !== 1 ? "s" : ""} · top: {formatEth(highestBid ?? "0")} tFIL
              </div>
            )}
            {mode === "marketplace" && bidCount === 0 && (
              <div className="text-xs text-muted-foreground font-base">85% to witness</div>
            )}
            {mode === "dashboard" && (
              <div className="text-xs text-muted-foreground font-base">
                {r.sold ? "Sold" : "Available"}
              </div>
            )}
          </div>

          {mode === "marketplace" && (
            <div className="flex gap-1">
              <Link href={`/recording/${r.recording_id}`}>
                <Button size="sm" variant="neutral">
                  View
                </Button>
              </Link>
              {!r.sold && !isOwner && (
                <>
                  <Button size="sm" variant="neutral" onClick={() => onBid?.(r)}>
                    Offer
                  </Button>
                  <Button size="sm" onClick={() => onBuy?.(r)} disabled={isBuying}>
                    {isBuying ? "Buying…" : "Buy Now"}
                  </Button>
                </>
              )}
              {r.sold && (
                <Badge className="bg-chart-2 text-black">Sold</Badge>
              )}
            </div>
          )}
          {mode === "dashboard" && r.cid && (
            <Link href={`/recording/${r.recording_id}`}>
              <Button variant="neutral" size="sm">View ↗</Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
