"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Avatar, Input, Spinner } from "./ui";
import type { User } from "@/lib/types";

type SearchUser = Pick<User, "id" | "username" | "display_name" | "avatar_url">;

/** Debounced @username / phone search with result list. */
export default function UserSearch({
  onSelect,
  placeholder = "Search @username or phone",
}: {
  onSelect: (user: SearchUser) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
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
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          autoFocus
        />
        {loading && <Spinner className="absolute right-3 top-3.5" />}
      </div>
      <ul className="space-y-1">
        {results.map((u) => (
          <li key={u.id}>
            <button
              onClick={() => onSelect(u)}
              className="w-full flex items-center gap-3 rounded-card px-3 py-2.5 hover:bg-surface-2 transition-colors text-left"
            >
              <Avatar username={u.username} avatarUrl={u.avatar_url} />
              <div>
                <p className="font-semibold text-sm">@{u.username}</p>
                {u.display_name && (
                  <p className="text-xs text-text-2">{u.display_name}</p>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
