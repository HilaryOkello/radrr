"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

type RecordingPhase =
  | "idle"
  | "requesting"
  | "recording"
  | "processing"
  | "anchoring"
  | "uploading"
  | "encrypting"
  | "done"
  | "error";

interface ChunkHash {
  index: number;
  hash: string;
}

interface RecordingResult {
  recordingId: string;
  merkleRoot: string;
  txHash: string;
  cid: string;
  chunkCount: number;
  gps: string;
}

function generateRecordingId(): string {
  return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function RecordPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingIdRef = useRef<string>("");

  const [phase, setPhase] = useState<RecordingPhase>("idle");
  const [chunkHashes, setChunkHashes] = useState<ChunkHash[]>([]);
  const [merkleRoot, setMerkleRoot] = useState<string | null>(null);
  const [result, setResult] = useState<RecordingResult | null>(null);
  const [gps, setGps] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Init Web Worker
  useEffect(() => {
    workerRef.current = new Worker("/workers/hash-worker.js");
    workerRef.current.onmessage = (e) => {
      const { type, index, hash, root, hashes } = e.data;
      if (type === "chunkHashed") {
        setChunkHashes((prev) => [...prev, { index, hash }]);
      } else if (type === "merkleRoot") {
        setMerkleRoot(root);
        handleMerkleRootReady(root, hashes.length);
      }
    };
    return () => workerRef.current?.terminate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get GPS on mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // City-level: round to 2 decimal places (~1km)
          const lat = pos.coords.latitude.toFixed(2);
          const lng = pos.coords.longitude.toFixed(2);
          setGps(`${lat},${lng}`);
        },
        () => setGps("unknown"),
        { timeout: 10000 }
      );
    } else {
      setGps("unavailable");
    }
  }, []);

  const handleMerkleRootReady = useCallback(
    async (root: string, chunkCount: number) => {
      setPhase("anchoring");
      const id = recordingIdRef.current;

      try {
        // 1. Anchor on NEAR
        const anchorRes = await fetch("/api/anchor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recordingId: id,
            merkleRoot: root,
            gpsApprox: gps ?? "unknown",
            timestamp: Date.now(),
          }),
        });
        if (!anchorRes.ok) throw new Error("Anchor failed");
        const { txHash } = await anchorRes.json();
        toast.success("Proof anchored on Filecoin!");

        // 2. Upload to Storacha
        setPhase("uploading");
        const videoBlob = new Blob(chunksRef.current, { type: "video/webm" });
        const formData = new FormData();
        formData.append("video", videoBlob, `${id}.webm`);
        formData.append("recordingId", id);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) throw new Error("Upload failed");
        const { cid } = await uploadRes.json();
        toast.success("Footage stored on Filecoin!");

        // 3. Encrypt with Lit Protocol
        setPhase("encrypting");
        const encryptRes = await fetch("/api/encrypt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordingId: id, cid }),
        });
        if (!encryptRes.ok) throw new Error("Encrypt failed");
        toast.success("Footage encrypted with Lit Protocol!");

        setResult({
          recordingId: id,
          merkleRoot: root,
          txHash,
          cid,
          chunkCount,
          gps: gps ?? "unknown",
        });
        setPhase("done");
      } catch (err) {
        console.error(err);
        toast.error("Something went wrong. Check console.");
        setPhase("error");
      }
    },
    [gps]
  );

  const startRecording = async () => {
    setPhase("requesting");
    setChunkHashes([]);
    setMerkleRoot(null);
    setResult(null);
    chunksRef.current = [];
    workerRef.current?.postMessage({ type: "reset" });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: true,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.play();
      }

      recordingIdRef.current = generateRecordingId();
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2_500_000,
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          e.data.arrayBuffer().then((buf) => {
            workerRef.current?.postMessage({ type: "chunk", chunk: buf }, [buf]);
          });
        }
      };

      recorder.onstop = () => {
        workerRef.current?.postMessage({ type: "finish" });
        setPhase("processing");
        if (timerRef.current) clearInterval(timerRef.current);
        stream.getTracks().forEach((t) => t.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
      };

      recorder.start(1000); // emit chunk every 1 second
      setPhase("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch (err) {
      console.error(err);
      toast.error("Could not access camera.");
      setPhase("error");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const phaseLabel: Record<RecordingPhase, string> = {
    idle: "Ready to record",
    requesting: "Requesting camera...",
    recording: "Recording",
    processing: "Computing Merkle root...",
    anchoring: "Anchoring proof on NEAR...",
    uploading: "Uploading to Filecoin...",
    encrypting: "Encrypting with Lit Protocol...",
    done: "Complete",
    error: "Error",
  };

  const phaseProgress: Record<RecordingPhase, number> = {
    idle: 0,
    requesting: 5,
    recording: 20,
    processing: 40,
    anchoring: 55,
    uploading: 70,
    encrypting: 85,
    done: 100,
    error: 0,
  };

  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b-2 border-border px-6 py-4 flex items-center justify-between bg-secondary-background">
        <Link href="/" className="text-2xl font-heading tracking-tight">radrr</Link>
        <div className="flex gap-3">
          <Link href="/dashboard"><Button variant="neutral" size="sm">Dashboard</Button></Link>
          <Link href="/marketplace"><Button variant="neutral" size="sm">Marketplace</Button></Link>
        </div>
      </nav>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* Left: Camera */}
        <div className="border-r-2 border-border flex flex-col">
          <div className="relative bg-black aspect-video w-full">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
            />
            {phase === "idle" && (
              <div className="absolute inset-0 flex items-center justify-center text-white text-lg font-base opacity-60">
                Camera preview will appear here
              </div>
            )}
            {phase === "recording" && (
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white font-heading text-sm bg-black/50 px-2 py-1 rounded">
                  REC {formatTime(elapsed)}
                </span>
              </div>
            )}
            {chunkHashes.length > 0 && phase === "recording" && (
              <div className="absolute bottom-4 left-4 bg-black/70 text-green-400 text-xs font-mono px-3 py-2 rounded max-w-xs">
                <div className="font-heading text-white text-xs mb-1">
                  {chunkHashes.length} chunk{chunkHashes.length !== 1 ? "s" : ""} hashed
                </div>
                <div className="truncate opacity-80">
                  latest: {chunkHashes[chunkHashes.length - 1]?.hash.slice(0, 16)}...
                </div>
              </div>
            )}
          </div>

          <div className="p-6 flex flex-col gap-4 flex-1 bg-background">
            {phase === "idle" && (
              <Button size="lg" onClick={startRecording} className="w-full text-base">
                Start Recording
              </Button>
            )}
            {phase === "recording" && (
              <Button
                size="lg"
                variant="neutral"
                onClick={stopRecording}
                className="w-full text-base border-red-500 text-red-600"
              >
                Stop Recording
              </Button>
            )}
            {(phase === "processing" ||
              phase === "anchoring" ||
              phase === "uploading" ||
              phase === "encrypting") && (
              <Button size="lg" disabled className="w-full text-base">
                {phaseLabel[phase]}
              </Button>
            )}
            {phase === "done" && (
              <div className="flex gap-3">
                <Button
                  size="lg"
                  variant="neutral"
                  onClick={() => {
                    setPhase("idle");
                    setChunkHashes([]);
                    setMerkleRoot(null);
                    setResult(null);
                    chunksRef.current = [];
                  }}
                  className="flex-1"
                >
                  Record Again
                </Button>
                <Link href="/dashboard" className="flex-1">
                  <Button size="lg" className="w-full">View Dashboard →</Button>
                </Link>
              </div>
            )}

            {gps && (
              <div className="text-xs font-mono text-muted-foreground">
                📍 GPS: {gps} (city-level approx)
              </div>
            )}
          </div>
        </div>

        {/* Right: Proof chain */}
        <div className="flex flex-col p-6 gap-6 overflow-y-auto">
          {/* Status */}
          <Card className="border-2 border-border">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Recording Status</span>
                <Badge
                  variant={
                    phase === "done" || phase === "recording"
                      ? "default"
                      : "neutral"
                  }
                >
                  {phaseLabel[phase]}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={phaseProgress[phase]} className="h-3" />
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="font-base text-muted-foreground">Chunks hashed</div>
                <div className="font-heading">{chunkHashes.length}</div>
                <div className="font-base text-muted-foreground">Merkle root</div>
                <div className="font-mono text-xs break-all">
                  {merkleRoot ? merkleRoot.slice(0, 20) + "..." : "—"}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hash chain live feed */}
          {chunkHashes.length > 0 && (
            <Card className="border-2 border-border">
              <CardHeader>
                <CardTitle className="text-sm">
                  Hash Chain (live)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {chunkHashes.slice(-8).map((c) => (
                    <div
                      key={`${c.index}-${c.hash}`}
                      className="flex items-center gap-3 font-mono text-xs"
                    >
                      <span className="text-muted-foreground w-6">#{c.index}</span>
                      <span className="text-green-600 truncate">{c.hash}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Result */}
          {result && (
            <Card className="border-2 border-border bg-main/20">
              <CardHeader>
                <CardTitle>Proof Record</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <Row label="Recording ID" value={result.recordingId} mono />
                <Row label="Merkle Root" value={result.merkleRoot} mono truncate />
                <Row label="Filecoin Tx" value={result.txHash} mono truncate />
                <Row label="Filecoin CID" value={result.cid} mono truncate />
                <Row label="Chunks" value={String(result.chunkCount)} />
                <Row label="GPS Approx" value={result.gps} />
                <div className="pt-2 border-t-2 border-border text-xs text-muted-foreground font-base">
                  Encrypted with Lit Protocol · Stored on Filecoin · Anchored on NEAR
                </div>
              </CardContent>
            </Card>
          )}

          {/* How it works */}
          {phase === "idle" && (
            <Card className="border-2 border-border">
              <CardHeader>
                <CardTitle className="text-sm">How the proof works</CardTitle>
              </CardHeader>
              <CardContent className="text-sm font-base text-muted-foreground space-y-2">
                <p>1. Browser records video in 1-second chunks via MediaRecorder.</p>
                <p>2. Each chunk is SHA-256 hashed, chained to the previous hash.</p>
                <p>3. A Merkle root across all chunk hashes is computed in a Web Worker.</p>
                <p>4. The Merkle root + GPS + timestamp is anchored on NEAR Protocol.</p>
                <p>5. Full footage is uploaded to Filecoin via Storacha, CID linked on-chain.</p>
                <p>6. Footage is encrypted with Lit Protocol — only buyers can decrypt.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  mono = false,
  truncate = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
      <span className="text-muted-foreground font-base">{label}</span>
      <span
        className={`${mono ? "font-mono text-xs" : "font-base"} ${
          truncate ? "truncate" : "break-all"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
