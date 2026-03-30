"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FootageRecording } from "@/components/FootageCard";

function ipfsUrl(cid: string) {
  return `https://${cid}.ipfs.w3s.link`;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatTFIL(wei: string): string {
  const val = Number(wei) / 1e18;
  return val === 0 ? "Free" : `${val.toFixed(3)} tFIL`;
}

interface Props {
  recording: FootageRecording;
  walletAddress?: string;
  bids: { amount: string; status: string }[];
  userHasBid?: boolean;
  isBuying: boolean;
  onBuy: (r: FootageRecording) => void;
  onBid: (r: FootageRecording) => void;
  stagger?: number;
}

export function MarketplaceCard({
  recording: r,
  walletAddress,
  bids,
  userHasBid,
  isBuying,
  onBuy,
  onBid,
  stagger = 0,
}: Props) {
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isOwner = walletAddress?.toLowerCase() === r.witness?.toLowerCase();
  const pendingBids = bids.filter((b) => b.status === "Pending");
  const topBid = pendingBids.sort(
    (a, b) => Number(BigInt(b.amount) - BigInt(a.amount))
  )[0];

  const videoSrc = r.trailer_cid
    ? ipfsUrl(r.trailer_cid)
    : r.visibility_level === "full" && r.cid
    ? ipfsUrl(r.cid)
    : null;

  function handleVideoClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
    if (videoRef.current.paused) setPlaying(false);
  }

  return (
    <article
      className={`group border-2 border-border rounded-base bg-secondary-background overflow-hidden flex flex-col
        transition-all duration-200 ease-out
        hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_var(--border)]
        active:translate-y-0 active:shadow-none
        animate-slide-up stagger-${stagger}`}
    >
      {/* ── Thumbnail / Player ── */}
      <div
        className="relative bg-black aspect-video cursor-pointer overflow-hidden"
        onClick={() => videoSrc && setPlaying(true)}
      >
        {!playing && (
          r.preview_cid ? (
            <img
              src={ipfsUrl(r.preview_cid)}
              alt={r.title || "Recording"}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-secondary-background">
              <span className="text-5xl opacity-20">📹</span>
            </div>
          )
        )}

        {playing && videoSrc && (
          <>
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <video
              ref={videoRef}
              src={videoSrc}
              className="w-full h-full object-contain"
              autoPlay muted loop playsInline
              onCanPlay={() => setLoaded(true)}
              onClick={handleVideoClick}
            />
          </>
        )}

        {/* Desktop play hover */}
        {!playing && videoSrc && (
          <div className="absolute inset-0 hidden sm:flex items-center justify-center bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <div className="w-12 h-12 rounded-full bg-white border-2 border-border flex items-center justify-center shadow-[2px_2px_0px_0px_var(--border)] animate-pop">
              <span className="text-lg ml-1">▶</span>
            </div>
          </div>
        )}

        {/* Mobile play button */}
        {!playing && videoSrc && (
          <div className="absolute inset-0 flex sm:hidden items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-white/80 border border-border flex items-center justify-center">
              <span className="text-sm ml-0.5">▶</span>
            </div>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1 max-w-[70%]">
          {r.corroboration_bundle.length > 0 && (
            <Badge className="bg-[#0099FF] text-white text-[10px] px-1.5 py-0 leading-5">
              ✓ Verified
            </Badge>
          )}
          {r.sold && (
            <Badge className="bg-[#00D696] text-black text-[10px] px-1.5 py-0 leading-5">
              Sold
            </Badge>
          )}
          {isOwner && (
            <Badge className="bg-main text-black text-[10px] px-1.5 py-0 leading-5">
              Yours
            </Badge>
          )}
          {userHasBid && !r.sold && (
            <Badge className="bg-[#FF6B00] text-white text-[10px] px-1.5 py-0 leading-5">
              Bid Placed ✓
            </Badge>
          )}
        </div>

        {r.encrypted_cid && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-black/60 text-white border-0 text-[10px] px-1.5 py-0 leading-5">
              🔐
            </Badge>
          </div>
        )}

        {/* Price chip */}
        <div className="absolute bottom-2 right-2">
          <span className="bg-main font-heading text-xs px-2 py-0.5 rounded border border-black/20 shadow-sm">
            {formatTFIL(r.price_eth)}
          </span>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="px-3 pt-2.5 flex flex-col gap-1 flex-1">
        <h3 className="font-heading text-sm leading-snug line-clamp-1">
          {r.title || "Untitled Recording"}
        </h3>
        <p className="text-[11px] text-muted-foreground font-mono line-clamp-1">
          📍 {r.gps_approx} · {timeAgo(r.timestamp)}
        </p>
        {pendingBids.length > 0 ? (
          <p className="text-[11px] text-muted-foreground font-base">
            {pendingBids.length} offer{pendingBids.length !== 1 ? "s" : ""} · top{" "}
            <span className="font-heading text-foreground">{formatTFIL(topBid?.amount ?? "0")}</span>
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground font-base">85% to witness · no offers yet</p>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="px-3 pb-3 pt-2.5 border-t-2 border-border mt-2.5 flex gap-2">
        <Link href={`/recording/${r.recording_id}`} className="flex-1">
          <Button variant="neutral" size="sm" className="w-full text-xs h-8">
            View
          </Button>
        </Link>
        {!r.sold && !isOwner && !userHasBid && (
          <>
            <Button
              variant="neutral"
              size="sm"
              className="flex-1 text-xs h-8"
              onClick={() => onBid(r)}
            >
              Offer
            </Button>
            <Button
              size="sm"
              className="flex-1 text-xs h-8"
              onClick={() => onBuy(r)}
              disabled={isBuying}
            >
              {isBuying ? "Buying…" : "Buy"}
            </Button>
          </>
        )}
        {userHasBid && !r.sold && (
          <div className="flex-1 flex items-center justify-center text-xs text-[#FF6B00] font-heading">
            Bid Placed ✓
          </div>
        )}
        {r.sold && (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground font-base">
            Sold
          </div>
        )}
      </div>
    </article>
  );
}
