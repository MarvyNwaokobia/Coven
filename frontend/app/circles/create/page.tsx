"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import UserSearch from "@/components/UserSearch";
import { Button, Input, Card, Avatar, Alert, SectionHeading } from "@/components/ui";
import { UserGroupIcon } from "@/components/Icons";
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
    <AppShell title="New circle" back>
      <div className="mx-auto max-w-lg space-y-5">
        {/* Live preview of the circle being built. */}
        <Card className="flex items-center gap-4 py-5">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-soft text-2xl"
          >
            {emoji}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold text-ink">
              {name.trim() || "Untitled circle"}
            </p>
            <p className="text-xs text-ink-mute">
              {members.length + 1} member{members.length === 0 ? "" : "s"} · you're the creator
            </p>
          </div>
        </Card>

        <Card className="space-y-4">
          <Input
            label="Circle name"
            placeholder="Lagos Crew"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoFocus
            required
          />

          <fieldset>
            <legend className="mb-2 block text-xs font-semibold tracking-wide text-ink-soft">
              Pick an icon
            </legend>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEmoji(e)}
                  aria-pressed={emoji === e}
                  aria-label={`Icon ${e}`}
                  className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-xl transition-[background-color,translate,scale,box-shadow] duration-200 ease-out-soft active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                    emoji === e
                      ? "bg-brand shadow-e2 ring-2 ring-brand ring-offset-2"
                      : "bg-surface-2 hover:bg-surface-3"
                  }`}
                >
                  <span aria-hidden="true">{e}</span>
                </button>
              ))}
            </div>
          </fieldset>
        </Card>

        <div>
          <SectionHeading title="Invite members" count={members.length} />

          {members.length > 0 && (
            <ul className="mb-3 flex flex-wrap gap-2">
              {members.map((m) => (
                <li key={m.id}>
                  <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-1 pr-1.5 text-xs font-semibold text-ink shadow-e1">
                    <Avatar username={m.username} size={22} ring={false} />@{m.username}
                    <button
                      aria-label={`Remove @${m.username}`}
                      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-ink-mute transition-colors duration-200 hover:bg-neg-soft hover:text-neg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      onClick={() => setMembers((ms) => ms.filter((x) => x.id !== m.id))}
                    >
                      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                        <path strokeLinecap="round" d="M4 4l8 8M12 4l-8 8" />
                      </svg>
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <UserSearch
            label=""
            placeholder="Add by @username"
            onSelect={(u) =>
              setMembers((ms) =>
                ms.some((m) => m.id === u.id) ? ms : [...ms, { id: u.id, username: u.username }]
              )
            }
          />
        </div>

        {error && <Alert>{error}</Alert>}

        <Button
          fullWidth
          size="lg"
          icon={<UserGroupIcon className="h-4 w-4" />}
          onClick={create}
          loading={busy}
          disabled={!name.trim()}
        >
          Create {name.trim() || "circle"}
        </Button>
      </div>
    </AppShell>
  );
}
