"use client";

import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

/* Small UI primitives following the Coven White & Deep Blue Fintech system. */

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "navy";
}) {
  const styles = {
    primary:
      "bg-[#0a192f] hover:bg-[#0f2b5c] text-white shadow-xs disabled:opacity-40",
    navy:
      "bg-[#0f2b5c] hover:bg-[#1e3a8a] text-white shadow-xs disabled:opacity-40",
    secondary:
      "bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200 disabled:opacity-40",
    ghost: "bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 disabled:opacity-40",
    danger: "bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 disabled:opacity-40",
  }[variant];

  return (
    <button
      className={`rounded-full px-5 py-3 font-semibold text-sm transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    />
  );
}

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-2xl bg-white border border-slate-200 px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all shadow-2xs ${className}`}
      {...props}
    />
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl bg-white border border-slate-200/80 p-4 shadow-xs ${className}`}>
      {children}
    </div>
  );
}

export function StatusChip({
  status,
}: {
  status:
    | "completed"
    | "pending"
    | "failed"
    | "processing"
    | "open"
    | "complete"
    | "cancelled"
    | "paid"
    | "expired"
    | "withdrawn"
    | "rejected"
    | "executed";
}) {
  const styles: Record<string, string> = {
    completed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    complete: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    paid: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    executed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    withdrawn: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    pending: "bg-amber-50 text-amber-700 border border-amber-200",
    processing: "bg-blue-50 text-blue-700 border border-blue-200",
    open: "bg-blue-50 text-blue-700 border border-blue-200",
    failed: "bg-red-50 text-red-700 border border-red-200",
    rejected: "bg-red-50 text-red-700 border border-red-200",
    cancelled: "bg-slate-100 text-slate-600 border border-slate-200",
    expired: "bg-slate-100 text-slate-600 border border-slate-200",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize tracking-wide ${styles[status] ?? styles.pending}`}
    >
      {status}
    </span>
  );
}

export function Avatar({
  username,
  avatarUrl,
  size = 40,
}: {
  username: string;
  avatarUrl?: string | null;
  size?: number;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={username}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0 ring-2 ring-slate-100"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0 bg-[#0a192f] border border-slate-700 shadow-2xs"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
      }}
    >
      {username.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600 ${className}`}
    />
  );
}

export function EmptyState({
  emoji,
  title,
  subtitle,
  icon,
}: {
  emoji?: string;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
      <div className="w-12 h-12 rounded-full bg-slate-100 text-[#0a192f] flex items-center justify-center text-xl mb-3 border border-slate-200">
        {icon || emoji || "💳"}
      </div>
      <p className="font-bold text-slate-900">{title}</p>
      {subtitle && <p className="text-sm text-slate-500 mt-1 max-w-xs">{subtitle}</p>}
    </div>
  );
}
