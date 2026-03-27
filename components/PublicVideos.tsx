"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FootageCard, type FootageRecording } from "@/components/FootageCard";

export function PublicVideos() {
  const [recordings, setRecordings] = useState<FootageRecording[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/recordings")
      .then((r) => r.json())
      .then((d) => {
        const recs: FootageRecording[] = d.recordings ?? [];
        const publicRecs = recs.filter((r) => r.visibility_level === "full" && !r.sold);
        setRecordings(publicRecs.slice(0, 6));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-muted-foreground font-base animate-pulse">Loading public footage...</div>
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground font-base">
          No public footage yet. Connect your wallet to browse the full marketplace.
        </p>
        <Link href="/marketplace" className="text-main hover:underline text-sm font-base mt-2 inline-block">
          Browse marketplace →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {recordings.map((r) => (
        <FootageCard
          key={r.recording_id}
          recording={r}
          mode="marketplace"
          walletAddress={undefined}
        />
      ))}
    </div>
  );
}
