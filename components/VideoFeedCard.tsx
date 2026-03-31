"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useLocationName } from "@/hooks/useLocationName";
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

function formatEth(wei: string): string {
  const val = Number(wei) / 1e18;
  return val === 0 ? "Free" : `${val.toFixed(3)} tFIL`;
}

interface SimilarityInfo {
  totalMatches: number;
  averageScore: number;
  method: string;
}

interface Props {
  recording: FootageRecording;
  similarity?: SimilarityInfo;
  stagger?: number; // 0-5
}

export function VideoFeedCard({ recording: r, similarity, stagger = 0 }: Props) {
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const locationName = useLocationName(r.gps_approx);

  const videoSrc = r.trailer_cid
    ? ipfsUrl(r.trailer_cid)
    : r.visibility_level === "full" && r.cid
    ? ipfsUrl(r.cid)
    : null;

  function handlePlayClick() {
    if (!videoSrc) return;
    setPlaying(true);
  }

  function handleVideoClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
        setPlaying(false);
      }
    }
  }

  return (
    <article
      className={`group border-2 border-border rounded-base bg-secondary-background overflow-hidden
        transition-all duration-200 ease-out
        hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_var(--border)]
        active:translate-y-0 active:shadow-none
        animate-slide-up stagger-${stagger}`}
    >
      {/* ── Thumbnail / Player ─────────────────────────── */}
      <div
        className="relative bg-black aspect-video cursor-pointer overflow-hidden"
        onClick={handlePlayClick}
      >
        {/* Thumbnail image */}
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

        {/* Video player */}
        {playing && videoSrc && (
          <>
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <video
              ref={videoRef}
              src={videoSrc}
              className="w-full h-full object-contain"
              autoPlay
              muted
              loop
              playsInline
              onCanPlay={() => setLoaded(true)}
              onClick={handleVideoClick}
            />
          </>
        )}

        {/* Play button — desktop hover */}
        {!playing && videoSrc && (
          <div className="absolute inset-0 items-center justify-center bg-black/25 hidden sm:flex opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <div className="w-14 h-14 rounded-full bg-white border-2 border-border flex items-center justify-center shadow-[2px_2px_0px_0px_var(--border)] animate-pop">
              <span className="text-xl ml-1">▶</span>
            </div>
          </div>
        )}

        {/* Play button — always visible on mobile */}
        {!playing && videoSrc && (
          <div className="absolute inset-0 flex items-center justify-center sm:hidden">
            <div className="w-10 h-10 rounded-full bg-white/80 border border-border flex items-center justify-center">
              <span className="text-base ml-0.5">▶</span>
            </div>
          </div>
        )}

        {/* Top-left badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-2 max-w-[75%]">
          {similarity && similarity.totalMatches > 0 && (
            <Badge className="bg-chart-5 text-white text-xs px-2.5 py-1 leading-tight font-medium shadow-sm">
              ✓ {similarity.totalMatches} match{similarity.totalMatches > 1 ? 'es' : ''}
              {similarity.averageScore > 0.9 && " • High confidence"}
            </Badge>
          )}
          {!similarity && r.corroboration_bundle.length > 0 && (
            <Badge className="bg-[#0099FF] text-white text-xs px-2.5 py-1 leading-tight font-medium shadow-sm">
              ✓ Verified
            </Badge>
          )}
          {r.encrypted_cid && (
            <Badge className="bg-black/70 text-white border-0 text-xs px-2.5 py-1 leading-tight font-medium shadow-sm">
              🔐 Encrypted
            </Badge>
          )}
        </div>

        {/* Price chip — bottom right */}
        <div className="absolute bottom-2 right-2">
          <span className="bg-main font-heading text-xs px-2 py-0.5 rounded border border-black/20">
            {formatEth(r.price_eth)}
          </span>
        </div>
      </div>

      {/* ── Card body — intentionally compact ──────────── */}
      <div className="px-3 pt-2.5 pb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-heading text-sm leading-snug line-clamp-1">
            {r.title || "Untitled Recording"}
          </h3>
          <p className="text-[11px] text-muted-foreground font-mono mt-0.5 line-clamp-1">
            📍 {locationName ? `${locationName} (${r.gps_approx})` : r.gps_approx} · {timeAgo(r.timestamp)}
          </p>
        </div>

        <Link href={`/recording/${r.recording_id}`} className="shrink-0">
          <Button size="sm" className="h-7 text-xs px-3">
            View
          </Button>
        </Link>
      </div>
    </article>
  );
}
