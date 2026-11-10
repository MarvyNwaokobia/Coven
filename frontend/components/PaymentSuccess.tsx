"use client";

import { useEffect } from "react";
import { Avatar } from "./ui";
import { CheckCircleIcon } from "./Icons";
import { formatUSDC } from "@/lib/format";

/**
 * Full-screen confirmation when a payment lands. Auto-dismisses, but the
 * button is there from the first frame so nobody has to wait it out.
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
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-fade-in fixed inset-0 z-50 flex flex-col items-center justify-center bg-brand px-6 text-center text-white"
    >
      <div className="relative">
        <div className="ripple absolute inset-0" aria-hidden="true" />
        <Avatar username={username} size={88} ring={false} />
        <span
          aria-hidden="true"
          className="animate-scale-in absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-pos text-white ring-4 ring-brand"
          style={{ animationDelay: "260ms" }}
        >
          <CheckCircleIcon className="h-5 w-5" />
        </span>
      </div>

      <p
        className="amount animate-fade-up mt-8 text-4xl font-extrabold tracking-tight"
        style={{ animationDelay: "120ms" }}
      >
        {formatUSDC(amount)}
      </p>
      <p
        className="animate-fade-up mt-2 text-sm font-medium text-white/70"
        style={{ animationDelay: "180ms" }}
      >
        Sent to <span className="font-bold text-white">@{username}</span>
      </p>

      <button
        onClick={onDone}
        className="animate-fade-up mt-10 min-h-11 cursor-pointer rounded-full border border-white/25 px-6 text-sm font-semibold text-white/90 transition-[background-color,translate,scale] duration-200 ease-out-soft hover:bg-white/10 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        style={{ animationDelay: "300ms" }}
      >
        Done
      </button>
    </div>
  );
}
