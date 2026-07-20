"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import UserSearch from "@/components/UserSearch";
import { Button, Input, Card, Avatar } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/useAuth";

const EMOJIS = ["👥", "🌴", "🍽️", "🏠", "💼", "✈️", "🎉", "⚽", "💰", "🛒"];

export default function CreateCirclePage() {
  const router = useRouter();
  useAuth();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("👥");
  const [members, setMembers] = useState<{ id: string; username: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setBusy(true);
    setError("");
    try {
      const { circle } = await api<{ circle: { id: string } }>("/api/circles/create", {
        json: { name, emoji, memberUsernames: members.map((m) => m.username) },
      });
      router.replace(`/circles/${circle.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create circle");
      setBusy(false);
    }
  }

  return (
    <AppShell title="New Circle" back>
      <div className="space-y-5">
        <Card className="space-y-4">
          <Input
            placeholder='Circle name — "Lagos Crew"'
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoFocus
          />
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`text-2xl rounded-full p-2 transition-colors ${
                  emoji === e ? "bg-primary/25 ring-2 ring-primary" : "bg-surface-2"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </Card>

        <div>
          <p className="font-semibold text-sm mb-2">Invite members</p>
          {members.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {members.map((m) => (
                <span
                  key={m.id}
                  className="flex items-center gap-1.5 rounded-full bg-surface-2 border border-border pl-1 pr-2.5 py-1 text-sm"
                >
                  <Avatar username={m.username} size={22} />@{m.username}
                  <button
                    className="text-text-2 hover:text-danger ml-1"
                    onClick={() => setMembers((ms) => ms.filter((x) => x.id !== m.id))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <UserSearch
            onSelect={(u) =>
              setMembers((ms) =>
                ms.some((m) => m.id === u.id) ? ms : [...ms, { id: u.id, username: u.username }]
              )
            }
            placeholder="Add by @username"
          />
        </div>

        <Button className="w-full" onClick={create} disabled={busy || !name.trim()}>
          {busy ? "Creating…" : `Create ${emoji} ${name || "circle"}`}
        </Button>
        {error && <p className="text-danger text-sm text-center">{error}</p>}
      </div>
    </AppShell>
  );
}
