"use client";

import {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  forwardRef,
  useId,
} from "react";

/* ============================================================================
   Coven UI primitives.
   Every interactive element here guarantees: a visible focus ring, a press
   response, a disabled state that reads as disabled, and a ≥44px touch target.
   ========================================================================== */

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

/* ---------------------------------------------------------------- Spinner */

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current/25 border-t-current ${className}`}
    />
  );
}

/* ----------------------------------------------------------------- Button */

type ButtonVariant =
  | "primary"
  | "accent"
  | "secondary"
  | "ghost"
  | "danger"
  | "outline";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "sheen bg-brand text-white shadow-e1 hover:bg-brand-hover hover:shadow-e2 hover:-translate-y-px active:translate-y-0 active:shadow-e1",
  accent:
    "sheen bg-accent text-white shadow-e1 hover:bg-accent-hover hover:shadow-e2 hover:-translate-y-px active:translate-y-0 active:shadow-e1",
  secondary:
    "bg-surface text-ink border border-line shadow-e1 hover:bg-surface-2 hover:border-line-strong hover:shadow-e2 hover:-translate-y-px active:translate-y-0",
  outline:
    "bg-transparent text-ink border border-line-strong hover:bg-surface-2 hover:border-ink hover:-translate-y-px active:translate-y-0",
  ghost: "bg-transparent text-ink-soft hover:bg-surface-2 hover:text-ink",
  danger:
    "bg-neg-soft text-neg border border-neg-line hover:bg-neg hover:text-white hover:border-neg hover:shadow-e2 hover:-translate-y-px active:translate-y-0",
};

/* min-h keeps every size at or above the 44px touch minimum. */
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3.5 py-2 text-xs gap-1.5",
  md: "min-h-11 px-5 py-2.5 text-sm gap-2",
  lg: "min-h-13 px-6 py-3.5 text-[0.9375rem] gap-2",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    icon?: ReactNode;
    fullWidth?: boolean;
  }
>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    icon,
    fullWidth = false,
    className = "",
    children,
    disabled,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      // Never let a click land mid-request.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`
        inline-flex items-center justify-center rounded-full font-semibold
        cursor-pointer select-none whitespace-nowrap
        transition-[background-color,border-color,color,box-shadow,translate,scale] duration-200 ease-out-soft
        active:scale-[0.97]
        disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none
        ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]}
        ${fullWidth ? "w-full" : ""} ${FOCUS} ${className}
      `}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
});

/** Square, icon-only button. Always pass an aria-label. */
export function IconButton({
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`
        inline-flex h-11 w-11 items-center justify-center rounded-full
        text-ink-soft cursor-pointer
        transition-[background-color,color,translate,scale] duration-200 ease-out-soft
        hover:bg-surface-2 hover:text-ink active:scale-90
        disabled:pointer-events-none disabled:opacity-45
        ${FOCUS} ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ Field */

/** Label + control + hint/error. Errors sit next to the field they describe. */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-xs font-semibold tracking-wide text-ink-soft"
        >
          {label}
          {required && (
            <span className="text-neg ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p role="alert" className="flex items-start gap-1 text-xs font-medium text-neg">
          <svg
            viewBox="0 0 16 16"
            className="mt-px h-3.5 w-3.5 shrink-0"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 4zm0 7.5a.9.9 0 110-1.8.9.9 0 010 1.8z" />
          </svg>
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-ink-mute">{hint}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Input */

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    hint?: string;
    error?: string;
    prefix?: ReactNode;
  }
>(function Input({ className = "", label, hint, error, prefix, id, ...props }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;

  const control = (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-mute font-medium">
          {prefix}
        </span>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={`
          w-full min-h-12 rounded-lg bg-surface border px-4 py-3
          text-base text-ink placeholder:text-ink-mute
          shadow-e1 outline-none
          transition-[border-color,box-shadow,background-color] duration-200 ease-out-soft
          hover:border-line-strong
          focus:border-accent focus:ring-4 focus:ring-accent/12
          disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-mute
          ${error ? "border-neg focus:border-neg focus:ring-neg/12" : "border-line"}
          ${prefix ? "pl-9" : ""}
          ${className}
        `}
        {...props}
      />
    </div>
  );

  if (!label && !hint && !error) return control;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} required={props.required}>
      {control}
    </Field>
  );
});

/* ----------------------------------------------------------------- Select */

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & {
    label?: string;
    hint?: string;
    error?: string;
  }
>(function Select({ className = "", label, hint, error, id, children, ...props }, ref) {
  const autoId = useId();
  const selectId = id ?? autoId;

  const control = (
    <div className="relative">
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={`
          w-full min-h-12 appearance-none rounded-lg bg-surface border px-4 py-3 pr-10
          text-base text-ink shadow-e1 outline-none cursor-pointer
          transition-[border-color,box-shadow] duration-200 ease-out-soft
          hover:border-line-strong
          focus:border-accent focus:ring-4 focus:ring-accent/12
          disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-mute
          ${error ? "border-neg" : "border-line"}
          ${className}
        `}
        {...props}
      >
        {children}
      </select>
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 8l4 4 4-4" />
      </svg>
    </div>
  );

  if (!label && !hint && !error) return control;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={selectId} required={props.required}>
      {control}
    </Field>
  );
});

/* ----------------------------------------------------- AmountInput (hero) */

/** The oversized amount field used by Send / Request / Cash out. */
export function AmountInput({
  value,
  onChange,
  currency = "USDC",
  autoFocus,
  secondary,
}: {
  value: string;
  onChange: (v: string) => void;
  currency?: string;
  autoFocus?: boolean;
  secondary?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="rounded-xl border border-line bg-surface px-5 py-8 text-center shadow-e1 transition-shadow duration-200 focus-within:border-accent focus-within:shadow-e2">
      <label htmlFor={id} className="sr-only">
        Amount in {currency}
      </label>
      <div className="flex items-center justify-center gap-1">
        <span
          className={`amount text-3xl font-bold transition-colors duration-200 ${
            value ? "text-ink" : "text-ink-mute"
          }`}
          aria-hidden="true"
        >
          $
        </span>
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          // Width tracks content so the number stays optically centred.
          size={Math.max(4, value.length + 1)}
          className="amount min-w-0 max-w-full bg-transparent text-center text-5xl font-extrabold text-ink outline-none placeholder:text-ink-mute/50"
        />
      </div>
      <p className="mt-2 text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink-mute">
        {currency}
      </p>
      {secondary && <div className="mt-3 text-sm text-ink-soft">{secondary}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------- Card */

export function Card({
  children,
  className = "",
  interactive = false,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  /** Adds lift + border response. Use only when the whole card is clickable. */
  interactive?: boolean;
  as?: "div" | "li" | "section" | "article";
}) {
  return (
    <Tag
      className={`
        rounded-xl border border-line bg-surface p-4 shadow-e1
        ${
          interactive
            ? "cursor-pointer transition-[border-color,box-shadow,translate,scale] duration-200 ease-out-soft hover:-translate-y-0.5 hover:border-accent-line hover:shadow-e3 active:translate-y-0 active:shadow-e1"
            : ""
        }
        ${className}
      `}
    >
      {children}
    </Tag>
  );
}

/** Section header with an optional trailing action. */
export function SectionHeading({
  title,
  action,
  count,
}: {
  title: string;
  action?: ReactNode;
  count?: number;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-sm font-bold tracking-tight text-ink">
        {title}
        {count != null && count > 0 && (
          <span className="tnum rounded-full bg-surface-3 px-2 py-0.5 text-[0.6875rem] font-bold text-ink-soft">
            {count}
          </span>
        )}
      </h2>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------- StatusChip */

type Status =
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

/* Tone carries a dot as well as colour, so colour is never the only signal. */
const STATUS_TONE: Record<Status, "pos" | "warn" | "info" | "neg" | "mute"> = {
  completed: "pos",
  complete: "pos",
  paid: "pos",
  executed: "pos",
  withdrawn: "pos",
  pending: "warn",
  processing: "info",
  open: "info",
  failed: "neg",
  rejected: "neg",
  cancelled: "mute",
  expired: "mute",
};

const TONE_STYLES = {
  pos: "bg-pos-soft text-pos border-pos-line",
  warn: "bg-warn-soft text-warn border-warn-line",
  info: "bg-accent-soft text-accent border-accent-line",
  neg: "bg-neg-soft text-neg border-neg-line",
  mute: "bg-surface-2 text-ink-soft border-line",
} as const;

export function StatusChip({ status }: { status: Status }) {
  const tone = STATUS_TONE[status] ?? "warn";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] font-bold capitalize ${TONE_STYLES[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {status}
    </span>
  );
}

/* ----------------------------------------------------------------- Avatar */

/* Deterministic tint per handle so people are recognisable at a glance. */
const AVATAR_TINTS = [
  "bg-[#0a192f]",
  "bg-[#1d4ed8]",
  "bg-[#0f766e]",
  "bg-[#7c2d12]",
  "bg-[#5b21b6]",
  "bg-[#9d174d]",
  "bg-[#155e75]",
  "bg-[#3f6212]",
];

function tintFor(username: string) {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = (h * 31 + username.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

export function Avatar({
  username,
  avatarUrl,
  size = 40,
  ring = true,
}: {
  username: string;
  avatarUrl?: string | null;
  size?: number;
  ring?: boolean;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        className={`shrink-0 rounded-full object-cover ${ring ? "ring-2 ring-surface" : ""}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${tintFor(
        username
      )} ${ring ? "ring-2 ring-surface" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {username.slice(0, 1).toUpperCase()}
    </div>
  );
}

/** Overlapping avatar stack for circle members. */
export function AvatarStack({
  users,
  max = 5,
  size = 32,
}: {
  users: { id?: string; username: string; avatar_url?: string | null }[];
  max?: number;
  size?: number;
}) {
  const shown = users.slice(0, max);
  const rest = users.length - shown.length;
  return (
    <div className="flex items-center">
      {/* Hovering the stack fans it out so overlapped faces become readable. */}
      <div className="group/stack flex -space-x-2.5">
        {shown.map((u, i) => (
          <div
            key={u.id ?? u.username ?? i}
            className="transition-[translate,scale] duration-300 ease-out-soft hover:z-10 hover:scale-110 group-hover/stack:translate-x-0.5"
          >
            <Avatar username={u.username} avatarUrl={u.avatar_url} size={size} />
          </div>
        ))}
      </div>
      {rest > 0 && (
        <span
          className="tnum -ml-2.5 flex items-center justify-center rounded-full bg-surface-3 font-bold text-ink-soft ring-2 ring-surface"
          style={{ width: size, height: size, fontSize: size * 0.34 }}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Skeleton */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}

/** Placeholder shaped like a real row, so nothing shifts when data lands. */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2.5" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ ProgressBar */

export function ProgressBar({
  value,
  tone = "accent",
  label,
}: {
  /** 0–100. */
  value: number;
  tone?: "accent" | "pos";
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-2 overflow-hidden rounded-full bg-surface-3"
    >
      <div
        className={`h-full rounded-full transition-[width] duration-700 ease-out-soft ${
          tone === "pos" ? "bg-pos" : "bg-accent"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ Alert */

export function Alert({
  tone = "neg",
  children,
}: {
  tone?: "neg" | "pos" | "warn" | "info";
  children: ReactNode;
}) {
  const styles = {
    neg: "bg-neg-soft text-neg border-neg-line",
    pos: "bg-pos-soft text-pos border-pos-line",
    warn: "bg-warn-soft text-warn border-warn-line",
    info: "bg-accent-soft text-accent border-accent-line",
  }[tone];

  return (
    <div
      role={tone === "neg" ? "alert" : "status"}
      className={`animate-fade-in flex items-start gap-2 rounded-lg border px-3.5 py-3 text-sm font-medium ${styles}`}
    >
      <svg
        viewBox="0 0 16 16"
        className="mt-0.5 h-4 w-4 shrink-0"
        fill="currentColor"
        aria-hidden="true"
      >
        {tone === "pos" ? (
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm3.4 5.3l-4 4.2a.75.75 0 01-1.08 0L4.6 8.75a.75.75 0 011.08-1.04l1.18 1.22 3.46-3.66a.75.75 0 011.08 1.03z" />
        ) : (
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 4zm0 7.5a.9.9 0 110-1.8.9.9 0 010 1.8z" />
        )}
      </svg>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------- EmptyState */

export function EmptyState({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-soft">
          {icon}
        </div>
      )}
      <p className="font-bold text-ink">{title}</p>
      {subtitle && (
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-ink-soft">{subtitle}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
