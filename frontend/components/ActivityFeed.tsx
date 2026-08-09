"use client";

import { EmptyState } from "./ui";
import ActivityRow from "./ActivityRow";
import { BanknoteIcon } from "./Icons";
import type { ActivityItem } from "@/lib/types";

/**
 * One grouped surface with hairline-separated rows, so it reads as a ledger
 * rather than a stack of floating cards.
 */
export default function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<BanknoteIcon className="h-5 w-5" />}
        title="No activity yet"
        subtitle="Payments you send and receive will show up here."
      />
    );
  }

  return (
    <ul className="stagger divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-e1">
      {items.map((a, i) => (
        <li
          key={a.id}
          style={{ ["--i" as string]: i }}
          className="group/row relative px-4 py-3.5 transition-[background-color,translate] duration-200 ease-out-soft hover:translate-x-0.5 hover:bg-surface-2/70"
        >
          {/* Accent rail slides in from the left edge on hover. */}
          <span
            aria-hidden="true"
            className="absolute inset-y-2 left-0 w-0.5 origin-top scale-y-0 rounded-r-full bg-accent transition-transform duration-200 ease-out-soft group-hover/row:scale-y-100"
          />
          <ActivityRow item={a} />
        </li>
      ))}
    </ul>
  );
}
