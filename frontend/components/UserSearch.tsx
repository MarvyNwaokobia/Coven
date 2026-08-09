"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Avatar, Input, Spinner, EmptyState } from "./ui";
import { SearchIcon } from "./Icons";
import type { User } from "@/lib/types";

type SearchUser = Pick<User, "id" | "username" | "display_name" | "avatar_url">;

/** Debounced @username / phone search with a result list. */
export default function UserSearch({
  onSelect,
  placeholder = "Search @username or phone",
  label = "Who are you paying?",
}: {
  onSelect: (user: SearchUser) => void;
  placeholder?: string;
  label?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const { users } = await api<{ users: SearchUser[] }>(
          `/api/users/search?q=${encodeURIComponent(q)}`
        );
        setResults(users);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-3">
      {/* The label shifts the control down by its own height, so the overlaid
          icon and spinner anchor to the bottom of the wrapper, not the top. */}
      <div className="relative">
        <Input
          label={label || undefined}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          autoFocus
          className="pl-11"
        />
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3.5 left-3.5 h-4.5 w-4.5 text-ink-mute"
        />
        {loading && (
          <span className="absolute bottom-4 right-4 text-ink-mute">
            <Spinner />
          </span>
        )}
      </div>

      {results.length > 0 && (
        <ul
          className="stagger divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-e1"
          aria-label="Search results"
        >
          {results.map((u, i) => (
            <li key={u.id} style={{ ["--i" as string]: i }}>
              <button
                onClick={() => onSelect(u)}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-accent-soft focus-visible:outline-none focus-visible:bg-accent-soft focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
              >
                <Avatar username={u.username} avatarUrl={u.avatar_url} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">@{u.username}</span>
                  {u.display_name && (
                    <span className="block truncate text-xs text-ink-mute">{u.display_name}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {searched && !loading && results.length === 0 && (
        <EmptyState
          icon={<SearchIcon className="h-5 w-5" />}
          title={`No one matching “${q}”`}
          subtitle="Check the spelling, or ask them for their exact @handle."
        />
      )}

      {!searched && q.trim().length < 2 && (
        <p className="px-1 text-xs text-ink-mute">
          Type at least 2 characters to search.
        </p>
      )}
    </div>
  );
}
