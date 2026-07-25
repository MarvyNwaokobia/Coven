"use client";

import { Card, EmptyState } from "./ui";
import ActivityRow from "./ActivityRow";
import type { ActivityItem } from "@/lib/types";

export default function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        emoji="💸"
        title="No activity yet"
        subtitle="Payments you send and receive will show up here"
      />
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((a) => (
        <li key={a.id}>
          <Card>
            <ActivityRow item={a} />
          </Card>
        </li>
      ))}
    </ul>
  );
}
