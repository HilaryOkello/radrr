"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const wasConnected = useRef(false);
  const initialized = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!initialized.current) {
      // First run after mount — record current state, don't celebrate
      initialized.current = true;
      wasConnected.current = isConnected;
      return;
    }
    if (isConnected && !wasConnected.current) {
      toast.success("🎉 Wallet connected", { position: "top-center" });
    }
    wasConnected.current = isConnected;
  }, [isConnected, mounted]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!mounted) {
    return (
      <Button variant="neutral" size="sm" disabled className="font-mono text-xs opacity-50">
        Loading…
      </Button>
    );
  }

  if (isConnected && address) {
    return (
      <div ref={ref} className="relative">
        <Button
          variant="neutral"
          size="sm"
          onClick={() => setOpen((o) => !o)}
          className="font-mono text-xs"
        >
          {address.slice(0, 6)}…{address.slice(-4)}
        </Button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-main border-2 border-border rounded-base shadow-shadow z-50 animate-pop">
            <div className="px-4 py-3 border-b-2 border-border">
              <p className="text-xs text-muted-foreground mb-1 font-base">Connected wallet</p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs truncate flex-1">{address}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(address);
                    toast.success("Address copied");
                    setOpen(false);
                  }}
                  className="shrink-0 text-xs font-base border-2 border-border rounded px-2 py-0.5 hover:bg-secondary-background transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
            <div className="px-4 py-3">
              <button
                onClick={() => { disconnect(); setOpen(false); }}
                className="w-full text-left text-sm font-base text-red-600 hover:text-red-700 font-medium"
              >
                Disconnect wallet
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const injectedConnector = connectors[0];
  return (
    <Button
      size="sm"
      onClick={() => connect({ connector: injectedConnector })}
      disabled={isPending}
    >
      {isPending ? "Connecting…" : "Connect Wallet"}
    </Button>
  );
}
