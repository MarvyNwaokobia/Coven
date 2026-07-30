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
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`text-xl rounded-full p-2.5 transition-all ${
                  emoji === e
                    ? "bg-[#0a192f] text-white ring-2 ring-[#0a192f]"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        </Card>

        <div>
          <p className="font-bold text-slate-900 text-sm mb-2">Invite members</p>
          {members.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {members.map((m) => (
                <span
                  key={m.id}
                  className="flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 pl-1 pr-2.5 py-1 text-xs font-semibold text-slate-800"
                >
                  <Avatar username={m.username} size={22} />@{m.username}
                  <button
                    className="text-slate-400 hover:text-red-600 ml-1 font-bold"
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
          {busy ? "Creating…" : `Create ${name || "Circle"}`}
        </Button>
        {error && <p className="text-red-600 text-sm font-medium text-center">{error}</p>}
      </div>
    </AppShell>
  );
}
