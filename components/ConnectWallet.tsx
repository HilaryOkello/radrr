"use client";

import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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
      <Button
        variant="neutral"
        size="sm"
        onClick={() => disconnect()}
        className="font-mono text-xs"
      >
        {address.slice(0, 6)}…{address.slice(-4)}
      </Button>
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
