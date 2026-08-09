"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Button, Card, Avatar, Skeleton, EmptyState } from "@/components/ui";
import { SendIcon, RequestIcon, SearchIcon } from "@/components/Icons";
import { useAuth } from "@/lib/useAuth";
import { formatUSDC } from "@/lib/format";

interface PublicProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  total_sent: number;
  total_received: number;
  created_at: string;
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/users/${username}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(({ user }) => setProfile(user))
      .catch(() => setNotFound(true));
  }, [username]);

  if (notFound) {
    return (
      <AppShell title="Profile" back>
        <div className="mx-auto max-w-lg">
          <EmptyState
            icon={<SearchIcon className="h-5 w-5" />}
            title={`@${username} not found`}
            subtitle="Double-check the handle. Usernames are unique and case-insensitive."
            action={
              <Button variant="secondary" onClick={() => router.push("/send")}>
                Search for someone else
              </Button>
            }
          />
        </div>
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell title="Profile" back>
        <div className="mx-auto flex max-w-lg flex-col items-center py-8">
          <Skeleton className="h-22 w-22 rounded-full" />
          <Skeleton className="mt-5 h-6 w-40" />
          <Skeleton className="mt-2 h-4 w-28" />
          <div className="mt-8 grid w-full grid-cols-2 gap-3">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  const isMe = user?.id === profile.id;
  const joined = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <AppShell title={`@${profile.username}`} back>
      <div className="animate-fade-up mx-auto max-w-lg">
        <div className="flex flex-col items-center py-6 text-center">
          <Avatar username={profile.username} avatarUrl={profile.avatar_url} size={88} />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink">
            @{profile.username}
          </h1>
          {profile.display_name && (
            <p className="mt-0.5 font-medium text-ink-soft">{profile.display_name}</p>
          )}
          {profile.bio && (
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-soft">{profile.bio}</p>
          )}
          <p className="mt-3 text-xs text-ink-mute">On Coven since {joined}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="py-4 text-center">
            <p className="amount text-xl font-extrabold text-ink">
              {formatUSDC(profile.total_sent)}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-ink-mute">Sent</p>
          </Card>
          <Card className="py-4 text-center">
            <p className="amount text-xl font-extrabold text-pos">
              {formatUSDC(profile.total_received)}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-ink-mute">Received</p>
          </Card>
        </div>

        {!isMe && (
          <div className="mt-5 flex gap-3">
            <Button
              fullWidth
              size="lg"
              icon={<SendIcon className="h-4 w-4" />}
              onClick={() => router.push(`/send?to=${profile.username}`)}
            >
              Send
            </Button>
            <Button
              fullWidth
              size="lg"
              variant="secondary"
              icon={<RequestIcon className="h-4 w-4" />}
              onClick={() => router.push("/request")}
            >
              Request
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
