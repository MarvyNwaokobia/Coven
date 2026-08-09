"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { Skeleton, EmptyState, Button } from "@/components/ui";
import { UserGroupIcon, PlusIcon, ChevronRightIcon } from "@/components/Icons";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";
import type { Circle } from "@/lib/types";

function CircleCardSkeleton() {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <Skeleton className="h-11 w-11 rounded-full" />
      <Skeleton className="mt-4 h-4 w-2/3" />
      <Skeleton className="mt-2 h-3 w-1/3" />
    </div>
  );
}

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
    <AppShell
      title="Circles"
      subtitle="Split bills and save together"
      action={
        <Link
          href="/circles/create"
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-semibold text-white shadow-e1 transition-[background-color,box-shadow,translate,scale] duration-200 ease-out-soft hover:bg-brand-hover hover:shadow-e2 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <PlusIcon className="h-4 w-4" />
          <span className="hidden sm:inline">New circle</span>
        </Link>
      }
    >
      {circles === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <CircleCardSkeleton key={i} />
          ))}
        </div>
      ) : circles.length === 0 ? (
        <div className="mx-auto max-w-lg">
          <EmptyState
            icon={<UserGroupIcon className="h-5 w-5" />}
            title="No circles yet"
            subtitle="Create one for your crew, team or family, then split bills evenly and pool savings toward a shared goal."
            action={
              <Button
                onClick={() => {
                  window.location.href = "/circles/create";
                }}
                icon={<PlusIcon className="h-4 w-4" />}
              >
                Create your first circle
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {circles.map((c, i) => (
            <li key={c.id} style={{ ["--i" as string]: i }}>
              <Link
                href={`/circles/${c.id}`}
                className="group flex h-full flex-col rounded-xl border border-line bg-surface p-5 shadow-e1 transition-[border-color,box-shadow,translate,scale] duration-200 ease-out-soft hover:-translate-y-1 hover:border-accent-line hover:shadow-e3 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-lg text-accent transition-[background-color,color,scale,rotate] duration-300 ease-spring group-hover:-rotate-6 group-hover:scale-110 group-hover:bg-accent group-hover:text-white">
                  {c.emoji ? (
                    <span aria-hidden="true">{c.emoji}</span>
                  ) : (
                    <UserGroupIcon className="h-5 w-5" />
                  )}
                </span>

                <span className="mt-4 block truncate text-base font-bold text-ink">
                  {c.name}
                </span>
                <span className="mt-0.5 block text-xs text-ink-mute">
                  {c.member_count} member{c.member_count === 1 ? "" : "s"}
                </span>

                <span className="mt-4 inline-flex -translate-x-1 items-center gap-1 text-xs font-bold text-accent opacity-0 transition-[opacity,translate] duration-200 ease-out-soft group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
                  Open circle
                  <ChevronRightIcon className="h-3.5 w-3.5 transition-transform duration-200 ease-out-soft group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
