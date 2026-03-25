"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

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
