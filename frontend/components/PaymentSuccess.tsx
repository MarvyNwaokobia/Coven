"use client";

import { useEffect } from "react";
import { Avatar } from "./ui";
import { formatUSDC } from "@/lib/format";

/**
 * Signature element: full-screen ripple pulsing outward from the avatar
 * when a payment lands. Arc's sub-500ms finality makes this feel instant.
 */
export default function PaymentSuccess({
  username,
  amount,
  onDone,
}: {
  username: string;
  amount: number;
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg/95 backdrop-blur">
      <div className="relative pc-ripple">
        <Avatar username={username} size={88} />
      </div>
      <p className="mt-6 text-2xl font-bold amount">{formatUSDC(amount)}</p>
      <p className="text-text-2 mt-1">
        sent to <span className="text-accent">@{username}</span>
      </p>
      <p className="text-xs text-text-2/70 mt-4">Settled on Arc ⚡</p>
    </div>
  );
}
