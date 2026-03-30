"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { ConnectWallet } from "@/components/ConnectWallet";
import { Navbar } from "@/components/Navbar";
import { useLocationName } from "@/hooks/useLocationName";

type RecordingPhase =
  | "idle"
  | "requesting"
  | "recording"
  | "processing"
  | "review"       // NEW: video ready locally, fill metadata before publishing
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

// Generate thumbnail from video blob at midpoint — returns JPEG blob or null
async function generateThumbnail(videoBlob: Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    const videoUrl = URL.createObjectURL(videoBlob);
    const tempVideo = document.createElement("video");
    tempVideo.src = videoUrl;
    tempVideo.muted = true;

    const cleanup = () => URL.revokeObjectURL(videoUrl);
    const timeout = setTimeout(() => { cleanup(); resolve(null); }, 10000);

    tempVideo.onloadedmetadata = () => {
      const duration = tempVideo.duration;
      if (!duration || !isFinite(duration) || duration <= 0) {
        tempVideo.currentTime = 0;
      } else {
        tempVideo.currentTime = Math.min(duration / 2, duration - 0.1);
      }
    };
    tempVideo.onseeked = () => {
      clearTimeout(timeout);
      const canvas = document.createElement("canvas");
      const width = tempVideo.videoWidth || 640;
      const height = tempVideo.videoHeight || 360;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        cleanup();
        resolve(null);
        return;
      }
      ctx.drawImage(tempVideo, 0, 0, width, height);
      cleanup();
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.7);
    };
    tempVideo.onerror = () => { clearTimeout(timeout); cleanup(); resolve(null); };
  });
}

type VisibilityLevel = "blur" | "trailer" | "thumbnail" | "full";
type LicenseType = "personal" | "editorial" | "commercial" | "cc_by" | "non_exclusive";

const VISIBILITY_OPTIONS: { value: VisibilityLevel; label: string; description: string }[] = [
  { value: "blur", label: "Blurred", description: "Buyers see blurred preview until purchase" },
  { value: "trailer", label: "Trailer Only", description: "Show 5s trailer, purchase for full video" },
  { value: "thumbnail", label: "Thumbnail Only", description: "Only thumbnail visible, purchase to view" },
  { value: "full", label: "Public", description: "Free viewing, purchase for ownership & 5% journalism fund" },
];

const LICENSE_OPTIONS: { value: LicenseType; label: string; description: string }[] = [
  { value: "non_exclusive", label: "Non-Exclusive", description: "You keep rights, can sell to multiple buyers" },
  { value: "personal", label: "Personal Use", description: "Buyer cannot redistribute" },
  { value: "editorial", label: "Editorial Use", description: "News/media can use with attribution" },
  { value: "commercial", label: "Commercial License", description: "Full commercial usage rights" },
  { value: "cc_by", label: "CC BY", description: "Creative Commons, attribution required" },
];

async function createTrailerFromVideo(videoBlob: Blob, onProgress?: (p: number) => void): Promise<Blob | null> {
  const videoUrl = URL.createObjectURL(videoBlob);
  const video = document.createElement("video");
  video.src = videoUrl;
  video.muted = true;
  video.preload = "auto";

  try {
    await new Promise<void>((res, rej) => {
      video.onloadedmetadata = () => res();
      video.onerror = () => rej(new Error("video load failed"));
      setTimeout(() => rej(new Error("metadata timeout")), 30000);
    });

    const duration = video.duration;
    if (!duration || !isFinite(duration) || duration <= 0) return null;

    const endTime = Math.min(5, duration);
    const fps = 30;
    const frameInterval = 1 / fps;
    const width = 640;
    const height = Math.round((video.videoHeight / video.videoWidth) * width) || 360;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const stream = canvas.captureStream(fps);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 500000 });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const done = new Promise<Blob>((res) => {
      recorder.onstop = () => res(new Blob(chunks, { type: mimeType }));
    });

    recorder.start(100);

    // Seek frame-by-frame waiting for each seek to complete
    for (let t = 0; t < endTime; t += frameInterval) {
      video.currentTime = t;
      await new Promise<void>((res) => { video.onseeked = () => res(); });
      ctx.drawImage(video, 0, 0, width, height);
      onProgress?.(Math.round((t / endTime) * 100));
    }

    recorder.stop();
    onProgress?.(100);
    return await done;
  } catch (err) {
    console.warn("[trailer-gen]", err);
    return null;
  } finally {
    URL.revokeObjectURL(videoUrl);
  }
}

export default function RecordPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reviewVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingIdRef = useRef<string>("");

  // Stored merkle state, waiting for user to fill metadata in review phase
  const pendingMerkleRef = useRef<{ root: string; chunkCount: number } | null>(null);
  const localVideoBlobRef = useRef<Blob | null>(null);
  const localVideoUrlRef = useRef<string | null>(null);

  const { address: connectedAddress } = useAccount();

  // Metadata — filled in review phase, not before recording
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceEth, setPriceEth] = useState("0.001");

  const [phase, setPhase] = useState<RecordingPhase>("idle");
  const [chunkHashes, setChunkHashes] = useState<ChunkHash[]>([]);
  const [merkleRoot, setMerkleRoot] = useState<string | null>(null);
  const [result, setResult] = useState<RecordingResult | null>(null);
  const [gps, setGps] = useState<string | null>(null);
  const locationName = useLocationName(gps ?? undefined);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  const [generateTrailer, setGenerateTrailer] = useState(false);
  const [trailerBlob, setTrailerBlob] = useState<Blob | null>(null);
  const [trailerUrl, setTrailerUrl] = useState<string | null>(null);
  const [isGeneratingTrailer, setIsGeneratingTrailer] = useState(false);
  const [trailerProgress, setTrailerProgress] = useState(0);

  const [visibilityLevel, setVisibilityLevel] = useState<VisibilityLevel>("blur");
  const [licenseType, setLicenseType] = useState<LicenseType>("non_exclusive");

  // Init Web Worker
  useEffect(() => {
    workerRef.current = new Worker("/workers/hash-worker.js");
    workerRef.current.onmessage = (e) => {
      const { type, index, hash, root, hashes } = e.data;
      if (type === "chunkHashed") {
        setChunkHashes((prev) => [...prev, { index, hash }]);
      } else if (type === "merkleRoot") {
        setMerkleRoot(root);
        // Store merkle result and enter review phase — don't publish yet
        pendingMerkleRef.current = { root, chunkCount: hashes.length };
        enterReviewPhase(root);
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

  // Cleanup local video URL on unmount
  useEffect(() => {
    return () => {
      if (localVideoUrlRef.current) URL.revokeObjectURL(localVideoUrlRef.current);
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
      if (trailerUrl) URL.revokeObjectURL(trailerUrl);
    };
  }, [thumbnailUrl, trailerUrl]);

  const enterReviewPhase = useCallback(async (root: string) => {
    // Build local blob for playback
    const videoBlob = new Blob(chunksRef.current, { type: "video/webm" });
    localVideoBlobRef.current = videoBlob;
    const url = URL.createObjectURL(videoBlob);
    localVideoUrlRef.current = url;
    setPhase("review");

    // Generate thumbnail in background
    generateThumbnail(videoBlob).then((thumbBlob) => {
      if (thumbBlob) {
        setThumbnailUrl(URL.createObjectURL(thumbBlob));
      }
    });
  }, []);

  // Called when user clicks "Publish to Marketplace" in review phase
  const handlePublish = useCallback(async () => {
    if (!pendingMerkleRef.current) return;
    const { root, chunkCount } = pendingMerkleRef.current;
    const id = recordingIdRef.current;
    const videoBlob = localVideoBlobRef.current!;

    setPhase("anchoring");

    try {
      // 0. Upload thumbnail to Storacha (no on-chain CID update)
      let previewCid = "";
      try {
        const thumbBlob = await generateThumbnail(videoBlob);
        if (thumbBlob) {
          const thumbForm = new FormData();
          thumbForm.append("file", thumbBlob, `${id}_thumb.jpg`);
          const thumbRes = await fetch("/api/upload-thumbnail", { method: "POST", body: thumbForm });
          if (thumbRes.ok) previewCid = (await thumbRes.json()).cid ?? "";
        }
      } catch (thumbErr) {
        console.warn("[thumbnail]", thumbErr);
      }

      // 1. Upload trailer if selected
      let trailerCid = "";
      if (generateTrailer && trailerBlob) {
        try {
          const trailerForm = new FormData();
          trailerForm.append("file", trailerBlob, `${id}_trailer.webm`);
          const trailerRes = await fetch("/api/upload-trailer", { method: "POST", body: trailerForm });
          if (trailerRes.ok) {
            trailerCid = (await trailerRes.json()).cid ?? "";
            toast.success("Trailer uploaded!");
          }
        } catch (trailerErr) {
          console.warn("[trailer-upload]", trailerErr);
        }
      }

      // 2. Anchor on Filecoin FVM
      const anchorRes = await fetch("/api/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordingId: id,
          merkleRoot: root,
          gpsApprox: gps ?? "unknown",
          title: title.trim() || "Untitled Recording",
          description: description.trim(),
          previewCid,
          trailerCid,
          visibilityLevel,
          licenseType,
          priceEth: priceEth || "0.001",
          timestamp: Date.now(),
          witness: connectedAddress ?? undefined,
        }),
      });
      if (!anchorRes.ok) throw new Error("Anchor failed");
      const { txHash, walletAddress } = await anchorRes.json();
      if (walletAddress) {
        localStorage.setItem("radrr_identity", JSON.stringify({ walletAddress }));
      }
      toast.success("Proof anchored on Filecoin!");

      // 3. Upload video to Storacha
      setPhase("uploading");
      const formData = new FormData();
      formData.append("video", videoBlob, `${id}.webm`);
      formData.append("recordingId", id);

      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { cid } = await uploadRes.json();
      toast.success("Footage stored on Filecoin!");

      // 4. Encrypt (AES-256-GCM with IPFS-backed key storage)
      setPhase("encrypting");
      let keyCid: string | null = null;
      try {
        const { encryptVideoClient } = await import("@/lib/encryption-client");
        const videoBytes = new Uint8Array(await videoBlob.arrayBuffer());
        const { ciphertext, iv, keyHash, encryptedKey } = await encryptVideoClient(videoBytes, id);

        // Upload encrypted video to IPFS
        const ciphertextBlob = new Blob(
          [JSON.stringify({ ciphertext, iv, keyHash, recordingId: id, encryptionType: "aes-256-gcm" })],
          { type: "application/json" }
        );
        const encFormData = new FormData();
        encFormData.append("video", ciphertextBlob, `${id}_encrypted.json`);
        encFormData.append("recordingId", id);
        const encUploadRes = await fetch("/api/upload-encrypted", { method: "POST", body: encFormData });

        if (!encUploadRes.ok) {
          throw new Error("Failed to upload encrypted video");
        }

        // Upload encryption key to IPFS via server API
        const keyUploadRes = await fetch("/api/upload-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordingId: id, encryptedKey, keyHash }),
        });

        if (!keyUploadRes.ok) {
          throw new Error("Failed to upload encryption key");
        }

        const { keyCid: uploadedKeyCid } = await keyUploadRes.json();
        keyCid = uploadedKeyCid;

        if (encUploadRes.ok) {
          toast.success("Footage encrypted with AES-256-GCM!");
        }
      } catch (encErr) {
        console.warn("[encryption] failed:", encErr);
        toast.warning("Encryption unavailable — footage stored unencrypted.");
      }

      setResult({ recordingId: id, merkleRoot: root, txHash, cid, chunkCount, gps: gps ?? "unknown" });
      setPhase("done");
      toast.success("🚀 Published on Filecoin", { position: "top-center" });

      // Free local video memory
      if (localVideoUrlRef.current) URL.revokeObjectURL(localVideoUrlRef.current);
      localVideoUrlRef.current = null;
      localVideoBlobRef.current = null;

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Check console.");
      setPhase("error");
    }
  }, [gps, connectedAddress, title, description, priceEth, generateTrailer, trailerBlob, visibilityLevel, licenseType]);

  const resetAll = useCallback(() => {
    setPhase("idle");
    setChunkHashes([]);
    setMerkleRoot(null);
    setResult(null);
    setTitle("");
    setDescription("");
    setPriceEth("0.001");
    setThumbnailUrl(null);
    setGenerateTrailer(false);
    setTrailerBlob(null);
    if (trailerUrl) URL.revokeObjectURL(trailerUrl);
    setTrailerUrl(null);
    setIsGeneratingTrailer(false);
    setTrailerProgress(0);
    setVisibilityLevel("blur");
    setLicenseType("non_exclusive");
    chunksRef.current = [];
    pendingMerkleRef.current = null;
    localVideoBlobRef.current = null;
    if (localVideoUrlRef.current) {
      URL.revokeObjectURL(localVideoUrlRef.current);
      localVideoUrlRef.current = null;
    }
    workerRef.current?.postMessage({ type: "reset" });
  }, [trailerUrl]);

  const startRecording = async () => {
    resetAll();
    setPhase("requesting");

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

      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
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

      recorder.start(1000);
      setPhase("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch (err) {
      console.error(err);
      toast.error("Could not access camera.");
      setPhase("error");
    }
  };

  const stopRecording = () => mediaRecorderRef.current?.stop();

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const phaseLabel: Record<RecordingPhase, string> = {
    idle: "Ready to record",
    requesting: "Requesting camera...",
    recording: "Recording",
    processing: "Computing Merkle root...",
    review: "Review & Publish",
    anchoring: "Anchoring proof on Filecoin...",
    uploading: "Uploading to Filecoin...",
    encrypting: "Encrypting footage...",
    done: "Published",
    error: "Error",
  };

  const phaseProgress: Record<RecordingPhase, number> = {
    idle: 0,
    requesting: 5,
    recording: 20,
    processing: 35,
    review: 40,
    anchoring: 55,
    uploading: 70,
    encrypting: 85,
    done: 100,
    error: 0,
  };

  const isPublishing = phase === "anchoring" || phase === "uploading" || phase === "encrypting";

  return (
    <main className="min-h-screen flex flex-col">
      <Navbar />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* Left: Camera / Review */}
        <div className="border-r-2 border-border flex flex-col">
          {/* Video area */}
          <div className="relative bg-black aspect-video w-full overflow-hidden">
            {/* Live camera (idle/recording/processing) */}
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${phase === "review" || phase === "done" ? "hidden" : ""}`}
              playsInline
              muted
            />

            {/* Review: playback of local recording */}
            {phase === "review" && localVideoUrlRef.current && (
              <video
                ref={reviewVideoRef}
                src={localVideoUrlRef.current}
                className="w-full h-full object-cover"
                controls
                playsInline
              />
            )}

            {/* Done: show thumbnail if available */}
            {phase === "done" && thumbnailUrl && (
              <img src={thumbnailUrl} className="w-full h-full object-cover" alt="thumbnail" />
            )}

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

          {/* Controls / Metadata form */}
          <div className="relative p-6 flex flex-col gap-4 flex-1 bg-background overflow-y-auto">
            <div aria-hidden className="absolute bottom-0 right-0 w-64 h-64 rounded-full bg-chart-2 opacity-[0.07] blur-[100px] pointer-events-none animate-blob blob-delay-2" />

            {/* Idle: wallet prompt or start button */}
            {phase === "idle" && !connectedAddress && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground font-base text-center">
                  Connect your wallet to anchor footage under your identity.
                </p>
                <ConnectWallet />
              </div>
            )}
            {phase === "idle" && connectedAddress && (
              <Button size="lg" onClick={startRecording} className="w-full text-base">
                Start Recording
              </Button>
            )}

            {/* Recording: stop button */}
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

            {/* Processing: computing merkle */}
            {phase === "processing" && (
              <Button size="lg" disabled className="w-full text-base">
                Computing proof...
              </Button>
            )}

            {/* REVIEW PHASE: metadata form + publish */}
            {phase === "review" && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Badge variant="default">Recording ready</Badge>
                  <span className="text-xs text-muted-foreground font-base">
                    Stored locally · {chunkHashes.length} chunks · {merkleRoot?.slice(0, 12)}...
                  </span>
                </div>

                <div>
                  <label className="text-xs font-base text-muted-foreground mb-1 block">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Protest at City Hall, north entrance"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={120}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="text-xs font-base text-muted-foreground mb-1 block">
                    Description (optional)
                  </label>
                  <textarea
                    className="w-full rounded-base border-2 border-border bg-background px-3 py-2 text-sm font-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                    placeholder="Add context, background, or details about this footage..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={500}
                    rows={3}
                  />
                  <div className="text-xs text-muted-foreground text-right">{description.length}/500</div>
                </div>

                <div>
                  <label className="text-xs font-base text-muted-foreground mb-1 block">
                    Asking price (tFIL)
                  </label>
                  <Input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    placeholder="0.001"
                    value={priceEth}
                    onChange={(e) => setPriceEth(e.target.value)}
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    85% goes directly to you · buyers can also make offers
                  </div>
                </div>

                {thumbnailUrl && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-base text-muted-foreground">
                        Auto-generated thumbnail
                      </label>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!localVideoBlobRef.current) return;
                          const blob = await generateThumbnail(localVideoBlobRef.current);
                          if (blob) {
                            if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
                            setThumbnailUrl(URL.createObjectURL(blob));
                          }
                        }}
                        className="text-xs text-main hover:underline"
                      >
                        Regenerate
                      </button>
                    </div>
                    <img src={thumbnailUrl} className="rounded-base border-2 border-border w-full object-cover max-h-32" alt="thumbnail" />
                  </div>
                )}

                <div className="border-t-2 border-border pt-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="generate-trailer"
                      checked={generateTrailer}
                      onChange={async (e) => {
                        setGenerateTrailer(e.target.checked);
                        if (e.target.checked && !trailerBlob && localVideoBlobRef.current) {
                          setIsGeneratingTrailer(true);
                          setTrailerProgress(0);
                          const blob = await createTrailerFromVideo(localVideoBlobRef.current, setTrailerProgress);
                          if (blob) {
                            setTrailerBlob(blob);
                            setTrailerUrl(URL.createObjectURL(blob));
                          }
                          setIsGeneratingTrailer(false);
                        }
                      }}
                      disabled={isGeneratingTrailer}
                      className="w-4 h-4 rounded"
                    />
                    <div className="flex-1">
                      <label htmlFor="generate-trailer" className="text-sm font-base cursor-pointer">
                        Generate 5-second trailer
                        <span className="text-xs text-muted-foreground ml-2">(recommended for sales)</span>
                      </label>
                      {isGeneratingTrailer && (
                        <div className="mt-2">
                          <Progress value={trailerProgress} className="h-2" />
                          <span className="text-xs text-muted-foreground">Generating trailer... {trailerProgress}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {trailerUrl && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-base text-muted-foreground">
                          Trailer preview (5s)
                        </label>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!localVideoBlobRef.current) return;
                            setIsGeneratingTrailer(true);
                            setTrailerProgress(0);
                            const blob = await createTrailerFromVideo(localVideoBlobRef.current, setTrailerProgress);
                            if (blob) {
                              if (trailerUrl) URL.revokeObjectURL(trailerUrl);
                              setTrailerUrl(URL.createObjectURL(blob));
                              setTrailerBlob(blob);
                            }
                            setIsGeneratingTrailer(false);
                          }}
                          disabled={isGeneratingTrailer}
                          className="text-xs text-main hover:underline disabled:opacity-50"
                        >
                          Regenerate
                        </button>
                      </div>
                      <video src={trailerUrl} className="rounded-base border-2 border-border w-full" controls muted />
                    </div>
                  )}
                </div>

                <div className="border-t-2 border-border pt-4">
                  <label className="text-xs font-base text-muted-foreground mb-2 block">
                    Who can see your footage?
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {VISIBILITY_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex items-start gap-2 p-2 rounded-base border-2 cursor-pointer transition-colors ${
                          visibilityLevel === opt.value ? "border-ring bg-ring/10" : "border-border hover:border-muted-foreground"
                        }`}
                      >
                        <input
                          type="radio"
                          name="visibility"
                          value={opt.value}
                          checked={visibilityLevel === opt.value}
                          onChange={() => setVisibilityLevel(opt.value)}
                          className="mt-1"
                        />
                        <div>
                          <div className="text-sm font-base">{opt.label}</div>
                          <div className="text-xs text-muted-foreground">{opt.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-base text-muted-foreground mb-1 block">
                    License type
                  </label>
                  <select
                    value={licenseType}
                    onChange={(e) => setLicenseType(e.target.value as LicenseType)}
                    className="w-full rounded-base border-2 border-border bg-background px-3 py-2 text-sm font-base"
                  >
                    {LICENSE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label} — {opt.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    size="lg"
                    variant="neutral"
                    onClick={resetAll}
                    className="flex-1"
                  >
                    Discard
                  </Button>
                  <Button
                    size="lg"
                    onClick={handlePublish}
                    className="flex-1"
                    disabled={!title.trim() || isGeneratingTrailer}
                  >
                    {isGeneratingTrailer ? "Generating trailer…" : "Publish to Marketplace →"}
                  </Button>
                </div>
              </div>
            )}

            {/* Publishing: in-progress states */}
            {isPublishing && (
              <Button size="lg" disabled className="w-full text-base">
                {phaseLabel[phase]}
              </Button>
            )}

            {/* Done */}
            {phase === "done" && (
              <div className="flex gap-3">
                <Button size="lg" variant="neutral" onClick={resetAll} className="flex-1">
                  Record Again
                </Button>
                <Link href="/dashboard" className="flex-1">
                  <Button size="lg" className="w-full">View Dashboard →</Button>
                </Link>
              </div>
            )}

            {gps && phase !== "review" && (
              <div className="text-xs font-mono text-muted-foreground">
                📍 {locationName ? `${locationName} · ${gps}` : gps} (city-level approx)
              </div>
            )}
          </div>
        </div>

        {/* Right: Proof chain */}
        <div className="relative flex flex-col p-6 gap-6 overflow-y-auto">
          <div aria-hidden className="absolute inset-0 bg-dot-pattern opacity-[0.05] pointer-events-none" />
          <div aria-hidden className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-chart-1 opacity-[0.08] blur-[100px] pointer-events-none animate-blob" />
          <div aria-hidden className="absolute bottom-20 -left-10 w-56 h-56 rounded-full bg-chart-5 opacity-[0.07] blur-[100px] pointer-events-none animate-blob blob-delay-3" />
          {/* Status */}
          <Card className="border-2 border-border">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Recording Status</span>
                <Badge variant={phase === "done" || phase === "recording" ? "default" : "neutral"}>
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
                <CardTitle className="text-sm">Hash Chain (live)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {chunkHashes.slice(-8).map((c) => (
                    <div key={`${c.index}-${c.hash}`} className="flex items-center gap-3 font-mono text-xs">
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
                <Row label="Location" value={locationName ? `${locationName} · ${result.gps}` : result.gps} />
                <div className="pt-2 border-t-2 border-border text-xs text-muted-foreground font-base">
                  Encrypted · Stored on Filecoin · Anchored on Filecoin FVM
                </div>
              </CardContent>
            </Card>
          )}

          {/* How it works */}
          {(phase === "idle" || phase === "review") && (
            <Card className="border-2 border-border">
              <CardHeader>
                <CardTitle className="text-sm">
                  {phase === "review" ? "What happens when you publish" : "How the proof works"}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm font-base text-muted-foreground space-y-2">
                {phase === "review" ? (
                  <>
                    <p>1. Your Merkle proof is anchored on Filecoin FVM (tamper-evident).</p>
                    <p>2. The raw footage is uploaded to Filecoin via Storacha.</p>
                    <p>3. The footage is encrypted — only confirmed buyers can decrypt.</p>
                    <p>4. Your listing goes live on the marketplace at your asking price.</p>
                    <p>5. Buyers can pay the asking price or make you a custom offer.</p>
                  </>
                ) : (
                  <>
                    <p>1. Browser records video in 1-second chunks via MediaRecorder.</p>
                    <p>2. Each chunk is SHA-256 hashed, chained to the previous hash.</p>
                    <p>3. A Merkle root across all chunk hashes is computed in a Web Worker.</p>
                    <p>4. After recording, you review the footage and add metadata locally.</p>
                    <p>5. When ready, publish — footage is anchored, stored, and encrypted.</p>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}

function Row({ label, value, mono = false, truncate = false }: {
  label: string; value: string; mono?: boolean; truncate?: boolean;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 items-start">
      <span className="text-muted-foreground font-base">{label}</span>
      <span className={`${mono ? "font-mono text-xs" : "font-base"} ${truncate ? "truncate" : "break-all"}`}>
        {value}
      </span>
    </div>
  );
}
