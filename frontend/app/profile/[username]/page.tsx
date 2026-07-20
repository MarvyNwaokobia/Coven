"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { Button, Card, Avatar, Spinner } from "@/components/ui";
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
      <AppShell back>
        <Card className="text-center py-10">
          <p className="text-3xl mb-2">🤷</p>
          <p className="font-semibold">@{username} not found</p>
        </Card>
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell back>
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      </AppShell>
    );
  }

  const isMe = user?.id === profile.id;

  return (
    <AppShell back>
      <div className="flex flex-col items-center py-6">
        <Avatar username={profile.username} avatarUrl={profile.avatar_url} size={88} />
        <h1 className="mt-4 text-xl font-bold">@{profile.username}</h1>
        {profile.display_name && <p className="text-text-2">{profile.display_name}</p>}
        {profile.bio && (
          <p className="text-sm text-text-2 text-center mt-2 max-w-xs">{profile.bio}</p>
        )}

        <div className="grid grid-cols-2 gap-3 w-full mt-6">
          <Card className="text-center py-3">
            <p className="amount font-bold">{formatUSDC(profile.total_sent)}</p>
            <p className="text-xs text-text-2">Sent</p>
          </Card>
          <Card className="text-center py-3">
            <p className="amount font-bold">{formatUSDC(profile.total_received)}</p>
            <p className="text-xs text-text-2">Received</p>
          </Card>
        </div>

        {!isMe && (
          <div className="flex gap-3 w-full mt-6">
            <Button
              className="flex-1"
              onClick={() => router.push(`/send?to=${profile.username}`)}
            >
              Send
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => router.push(`/request`)}
            >
              Request
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
