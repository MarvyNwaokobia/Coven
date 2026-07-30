"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Card, Spinner, EmptyState } from "@/components/ui";
import { UserGroupIcon } from "@/components/Icons";
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
          className="rounded-full bg-[#0a192f] hover:bg-[#0f2b5c] text-white text-xs font-bold px-4 py-2.5 shadow-2xs transition-colors"
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
          icon={<UserGroupIcon className="w-6 h-6 text-slate-600" />}
          title="No circles yet"
          subtitle="Create one for your crew, team, or family — money moves together."
        />
      ) : (
        <ul className="space-y-2.5">
          {circles.map((c) => (
            <li key={c.id}>
              <Link href={`/circles/${c.id}`}>
                <Card className="flex items-center gap-3 hover:border-blue-600 transition-all">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg border border-blue-100 shrink-0">
                    {c.emoji || "👥"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-900 text-sm truncate">{c.name}</p>
                    <p className="text-xs font-medium text-slate-500">
                      {c.member_count} member{c.member_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="text-slate-400 font-bold">›</span>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
