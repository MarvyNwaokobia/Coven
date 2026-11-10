-- Web push subscriptions: one row per browser/device a user has allowed notifications on.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now()
);

create index if not exists idx_push_subscriptions_user on push_subscriptions(user_id);

-- Only the server (service role) reads or writes these; the keys must never reach other clients.
alter table push_subscriptions enable row level security;
