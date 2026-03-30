"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { VideoFeedCard } from "@/components/VideoFeedCard";
import type { FootageRecording } from "@/components/FootageCard";

export function PublicVideos() {
  const [recordings, setRecordings] = useState<FootageRecording[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/recordings")
      .then((r) => r.json())
      .then((d) => {
        const recs: FootageRecording[] = d.recordings ?? [];
        // Show all public footage, unsold first
        const pub = recs
          .filter((r) => r.visibility_level === "full" && !r.sold)
          .slice(0, 9);
        setRecordings(pub);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="border-2 border-border rounded-base bg-secondary-background animate-pulse"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="aspect-video bg-border/20" />
            <div className="p-3 space-y-2">
              <div className="h-4 bg-border/20 rounded w-3/4" />
              <div className="h-3 bg-border/20 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <div className="text-center py-16 border-2 border-dashed border-border rounded-base">
        <span className="text-5xl block mb-4">📹</span>
        <p className="font-heading text-lg mb-2">No public footage yet</p>
        <p className="text-muted-foreground font-base text-sm mb-6">
          Be the first to publish verified footage.
        </p>
        <Link
          href="/record"
          className="inline-block bg-main border-2 border-border px-6 py-2 font-heading rounded-base shadow-[2px_2px_0px_0px_var(--border)] hover:-translate-y-0.5 hover:shadow-[4px_4px_0px_0px_var(--border)] transition-all"
        >
          Start Recording →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {recordings.map((r, i) => (
        <VideoFeedCard
          key={r.recording_id}
          recording={r}
          stagger={Math.min(i, 5) as 0 | 1 | 2 | 3 | 4 | 5}
        />
      ))}
    </div>
  );
}
