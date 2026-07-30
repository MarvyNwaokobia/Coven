"use client";

import { useEffect } from "react";
import { Avatar } from "./ui";
import { formatUSDC } from "@/lib/format";

/**
 * Full-screen success overlay when a payment lands.
 * Deep royal blue background, crisp white typography, zero gradients.
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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a192f] text-white p-6 text-center">
      <div className="relative pc-ripple mb-2">
        <Avatar username={username} size={88} />
      </div>
      <p className="mt-6 text-3xl font-extrabold amount text-white">{formatUSDC(amount)}</p>
      <p className="text-slate-300 mt-1.5 text-sm font-medium">
        Sent to <span className="text-blue-400 font-semibold">@{username}</span>
      </p>
      <div className="mt-6 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-900/50 border border-blue-700/50 text-xs font-semibold text-blue-200 tracking-wide">
        <span>Settled on Arc in &lt;500ms</span>
      </div>
    </div>
  );
}
