"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  IDKitRequestWidget,
  useIDKitRequest,
  orbLegacy,
  type IDKitResult,
  type RpContext,
} from "@worldcoin/idkit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Phase = "form" | "verifying" | "done" | "error";

export default function VerifyPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("form");
  const [pseudonym, setPseudonym] = useState("");
  const [nearAccountId, setNearAccountId] = useState("");
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [loadingRp, setLoadingRp] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const APP_ID = (process.env.NEXT_PUBLIC_WORLDID_APP_ID ??
    "app_staging_placeholder") as `app_${string}`;
  const ACTION_ID =
    process.env.NEXT_PUBLIC_WORLDID_ACTION_ID ?? "radrr-witness-verify";
  const RP_ID = process.env.NEXT_PUBLIC_WORLDID_RP_ID ?? "";

  /** Fetch a signed RP context from the server before opening the widget. */
  const fetchRpContext = async (): Promise<RpContext | null> => {
    setLoadingRp(true);
    try {
      const res = await fetch("/api/rp-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: ACTION_ID }),
      });
      if (!res.ok) throw new Error("Failed to get RP signature");
      const { sig, nonce, created_at, expires_at } = await res.json();
      return {
        rp_id: RP_ID,
        nonce,
        created_at,
        expires_at,
        signature: sig,
      };
    } catch (err) {
      console.error(err);
      toast.error("Could not initialise World ID. Check server config.");
      return null;
    } finally {
      setLoadingRp(false);
    }
  };

  const handleOpenWidget = async () => {
    if (!pseudonym.trim() || !nearAccountId.trim()) {
      toast.error("Fill in your pseudonym and NEAR account ID first.");
      return;
    }
    const ctx = await fetchRpContext();
    if (!ctx) return;
    setRpContext(ctx);
    setWidgetOpen(true);
  };

  /** Called by the widget after local proof is collected — verify server-side. */
  const handleVerify = useCallback(
    async (result: IDKitResult) => {
      const res = await fetch("/api/verify-worldid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idkitResponse: result,
          accountId: nearAccountId,
          pseudonym: pseudonym.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Verification failed");
      }
    },
    [nearAccountId, pseudonym]
  );

  /** Called after both client proof and server verification succeed. */
  const handleSuccess = useCallback(
    async (result: IDKitResult) => {
      setPhase("verifying");
      try {
        // Extract nullifier hash from v4 result
        const nullifierHash =
          (result as unknown as Record<string, unknown>).nullifier_hash as string ??
          "verified";

        localStorage.setItem(
          "radrr_identity",
          JSON.stringify({
            nearAccountId,
            pseudonym: pseudonym.trim(),
            worldIdVerified: true,
            nullifierHash,
            verifiedAt: Date.now(),
          })
        );

        toast.success("World ID verified! Redirecting...");
        setPhase("done");
        setTimeout(() => router.push("/record"), 1500);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setErrorMsg(msg);
        setPhase("error");
        toast.error(msg);
      }
    },
    [nearAccountId, pseudonym, router]
  );

  const canOpen = pseudonym.trim() && nearAccountId.trim();

  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="border-b-2 border-border px-6 py-4 flex items-center justify-between bg-secondary-background">
        <Link href="/" className="text-2xl font-heading tracking-tight">
          radrr
        </Link>
        <Badge variant="neutral">Step 1 of 2: Verify Identity</Badge>
      </nav>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg flex flex-col gap-6">
          <div>
            <h1 className="text-4xl font-heading mb-2">Verify your identity</h1>
            <p className="text-muted-foreground font-base">
              Radrr uses World ID Proof of Personhood to ensure every witness is
              a real, unique human. Your identity stays pseudonymous — we never
              know who you are.
            </p>
          </div>

          {/* Profile form */}
          <Card className="border-2 border-border">
            <CardHeader>
              <CardTitle>Your witness profile</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="pseudonym">Pseudonym</Label>
                <Input
                  id="pseudonym"
                  placeholder="e.g. witness_nairobi_01"
                  value={pseudonym}
                  onChange={(e) => setPseudonym(e.target.value)}
                  disabled={phase !== "form"}
                />
                <p className="text-xs text-muted-foreground">
                  This is the name media houses see. Never use your real name.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="nearAccountId">NEAR Account ID</Label>
                <Input
                  id="nearAccountId"
                  placeholder="e.g. yourname.testnet"
                  value={nearAccountId}
                  onChange={(e) => setNearAccountId(e.target.value)}
                  disabled={phase !== "form"}
                />
                <p className="text-xs text-muted-foreground">
                  Your NEAR wallet address for receiving payments.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* World ID */}
          {phase === "form" && (
            <Card className="border-2 border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  World ID Verification
                  <Badge>Required</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground font-base">
                  Scan the QR code with the World App to prove you are a unique
                  human. No biometric data is stored anywhere.
                </p>

                <Button
                  size="lg"
                  onClick={handleOpenWidget}
                  disabled={!canOpen || loadingRp}
                  className="w-full"
                >
                  {loadingRp ? "Preparing..." : "Verify with World ID →"}
                </Button>

                {!canOpen && (
                  <p className="text-xs text-muted-foreground text-center">
                    Fill in pseudonym and NEAR account ID first.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Widget — rendered when rpContext is ready */}
          {rpContext && (
            <IDKitRequestWidget
              open={widgetOpen}
              onOpenChange={setWidgetOpen}
              app_id={APP_ID}
              action={ACTION_ID}
              rp_context={rpContext}
              allow_legacy_proofs={true}
              preset={orbLegacy({ signal: nearAccountId })}
              handleVerify={handleVerify}
              onSuccess={handleSuccess}
              onError={(code) => {
                toast.error(`World ID error: ${code}`);
                setWidgetOpen(false);
              }}
            />
          )}

          {phase === "verifying" && (
            <Card className="border-2 border-border bg-main/20">
              <CardContent className="py-8 text-center">
                <div className="text-4xl mb-4 animate-pulse">⛓️</div>
                <p className="font-heading text-lg">Saving your identity...</p>
              </CardContent>
            </Card>
          )}

          {phase === "done" && (
            <Card className="border-2 border-border bg-main/20">
              <CardContent className="py-8 text-center">
                <div className="text-5xl mb-4">✅</div>
                <p className="font-heading text-xl mb-2">Verified!</p>
                <p className="text-muted-foreground font-base">
                  Redirecting to record...
                </p>
              </CardContent>
            </Card>
          )}

          {phase === "error" && (
            <Card className="border-2 border-border">
              <CardContent className="py-6">
                <p className="text-red-600 font-base mb-4">{errorMsg}</p>
                <Button
                  onClick={() => {
                    setPhase("form");
                    setErrorMsg("");
                    setRpContext(null);
                  }}
                >
                  Try Again
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Why World ID */}
          <Card className="border-2 border-border">
            <CardContent className="pt-6">
              <h3 className="font-heading text-sm mb-3">Why World ID?</h3>
              <ul className="text-sm text-muted-foreground space-y-1 font-base">
                <li>• Prevents bots flooding the network with fake footage</li>
                <li>• Orb-verified biometrics without storing biometric data</li>
                <li>• Completely anonymous — platform never knows your real identity</li>
                <li>• One-time verification, then record freely</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
