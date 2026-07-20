"use client";

import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

/* Small UI primitives following the PayCircle design system. */

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const styles = {
    primary:
      "bg-primary hover:bg-primary-hover text-white disabled:opacity-40",
    secondary:
      "bg-surface-2 hover:bg-border text-text border border-border disabled:opacity-40",
    ghost: "bg-transparent hover:bg-surface-2 text-text-2 disabled:opacity-40",
    danger: "bg-danger/15 hover:bg-danger/25 text-danger disabled:opacity-40",
  }[variant];

  return (
    <button
      className={`rounded-full px-5 py-3 font-semibold text-sm transition-colors disabled:cursor-not-allowed ${styles} ${className}`}
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
      className={`w-full rounded-card bg-surface border border-border px-4 py-3 text-text placeholder:text-text-2/60 outline-none focus:border-primary transition-colors ${className}`}
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
    <div className={`rounded-card bg-surface border border-border p-4 ${className}`}>
      {children}
    </div>
  );
}

export function StatusChip({
  status,
}: {
  status: "completed" | "pending" | "failed" | "processing" | "open" | "complete" | "cancelled" | "paid" | "expired";
}) {
  const styles: Record<string, string> = {
    completed: "bg-success/15 text-success",
    complete: "bg-success/15 text-success",
    paid: "bg-success/15 text-success",
    pending: "bg-warning/15 text-warning",
    processing: "bg-accent/15 text-accent",
    open: "bg-accent/15 text-accent",
    failed: "bg-danger/15 text-danger",
    cancelled: "bg-text-2/15 text-text-2",
    expired: "bg-text-2/15 text-text-2",
  };
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status] ?? styles.pending}`}
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
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  const hue =
    [...username].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, hsl(${hue},60%,45%), hsl(${(hue + 40) % 360},60%,35%))`,
      }}
    >
      {username.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-5 w-5 animate-spin rounded-full border-2 border-text-2/30 border-t-accent ${className}`}
    />
  );
}

export function EmptyState({
  emoji,
  title,
  subtitle,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-4xl mb-3">{emoji}</div>
      <p className="font-semibold">{title}</p>
      {subtitle && <p className="text-sm text-text-2 mt-1">{subtitle}</p>}
    </div>
  );
}
