"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface HypercertEntry {
  tokenId: string;
  uri: string;
  name: string;
  description: string;
  image: string;
  contributor: string;
  recordingId: string | null;
  verificationLevel: string | null;
  isCorroborated: boolean | null;
  totalUnits: string;
  platform: string | null;
  createdAt: number;
}

function HypercertCard({ hc }: { hc: HypercertEntry }) {
  const contract = process.env.NEXT_PUBLIC_HYPERCERT_CONTRACT_ADDRESS ?? "0xa16DFb32Eb140a6f3F2AC68f41dAd8c7e83C4941";
  const openseaUrl = `https://testnets.opensea.io/assets/sepolia/${contract}/${hc.tokenId}`;

  const verificationColor =
    hc.isCorroborated
      ? "bg-chart-2 text-black"
      : hc.verificationLevel === "verified"
      ? "bg-chart-3 text-black"
      : "bg-main text-black";

  const verificationLabel =
    hc.isCorroborated
      ? "Corroborated"
      : hc.verificationLevel === "verified"
      ? "Verified"
      : hc.verificationLevel === "unverified"
      ? "Unverified"
      : "Pending";

  const dateStr =
    hc.createdAt > 0
      ? new Date(hc.createdAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null;

  return (
    <Card className="border-2 border-border overflow-hidden">
      <div className="relative aspect-video bg-secondary-background overflow-hidden">
        {hc.image ? (
          <img
            src={hc.image}
            alt={hc.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl">📜</span>
          </div>
        )}
        <div className="absolute top-2 left-2">
          <Badge className={`text-xs ${verificationColor}`}>
            {verificationLabel}
          </Badge>
        </div>
      </div>
      <CardContent className="py-3 flex flex-col gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <h3 className="font-heading text-sm line-clamp-2 leading-snug">
            {hc.name || "Untitled Hypercert"}
          </h3>
          {hc.contributor && (
            <p className="text-xs font-mono text-muted-foreground truncate">
              by {hc.contributor.slice(0, 8)}…{hc.contributor.slice(-6)}
            </p>
          )}
          {dateStr && (
            <p className="text-xs text-muted-foreground">{dateStr}</p>
          )}
        </div>

        {hc.recordingId && (
          <div className="flex flex-wrap gap-1">
            <Badge variant="neutral" className="bg-secondary-background text-xs">
              📹 {hc.recordingId.slice(0, 8)}…
            </Badge>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Link href={openseaUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="neutral" className="text-xs h-7">
              OpenSea
            </Button>
          </Link>
          {hc.recordingId && (
            <Link href={`/recording/${hc.recordingId}`}>
              <Button size="sm" className="text-xs h-7">
                View Recording
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function HypercertsList({
  hypercerts,
  emptyMessage,
}: {
  hypercerts: HypercertEntry[];
  emptyMessage?: string;
}) {
  if (hypercerts.length === 0) {
    return (
      <Card className="border-2 border-border">
        <CardContent className="py-12 text-center text-muted-foreground font-base">
          {emptyMessage ?? "No hypercerts found."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {hypercerts.map((hc) => (
        <HypercertCard key={hc.tokenId} hc={hc} />
      ))}
    </div>
  );
}
