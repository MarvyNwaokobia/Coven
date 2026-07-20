"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Card, Spinner, EmptyState } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";
import type { Circle } from "@/lib/types";

export default function CirclesPage() {
  const { user } = useAuth();
  const [circles, setCircles] = useState<Circle[] | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ circles: Circle[] }>("/api/circles")
      .then(({ circles }) => setCircles(circles))
      .catch(() => setCircles([]));
  }, [user]);

  return (
    <AppShell title="Circles">
      <div className="flex justify-end mb-3">
        <Link
          href="/circles/create"
          className="rounded-full bg-primary hover:bg-primary-hover text-white text-sm font-semibold px-4 py-2 transition-colors"
        >
          + New Circle
        </Link>
      </div>

      {circles === null ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : circles.length === 0 ? (
        <EmptyState
          emoji="👥"
          title="No circles yet"
          subtitle="Create one for your crew, team, or family — money moves together."
        />
      ) : (
        <ul className="space-y-2">
          {circles.map((c) => (
            <li key={c.id}>
              <Link href={`/circles/${c.id}`}>
                <Card className="flex items-center gap-3 hover:bg-surface-2 transition-colors">
                  <span className="text-2xl">{c.emoji}</span>
                  <div className="flex-1">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-text-2">
                      {c.member_count} member{c.member_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="text-text-2">›</span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
