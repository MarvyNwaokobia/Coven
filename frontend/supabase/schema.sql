-- PayCircle schema — run in the Supabase SQL editor (or via supabase db push).
-- Users table id matches auth.users id (Supabase Auth).

-- Users
create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  phone text unique,
  email text unique,
  avatar_url text,
  circle_wallet_id text unique,
  wallet_address text unique,
  bio text,
  total_sent numeric(20,6) default 0,
  total_received numeric(20,6) default 0,
  created_at timestamptz default now()
);

-- Friends (bidirectional friendship)
create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  friend_id uuid references users(id) not null,
  created_at timestamptz default now(),
  unique(user_id, friend_id)
);

-- Circles (groups)
create table if not exists circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text default '👥',
  creator_id uuid references users(id) not null,
  created_at timestamptz default now()
);

-- Circle members
create table if not exists circle_members (
  circle_id uuid references circles(id) not null,
  user_id uuid references users(id) not null,
  joined_at timestamptz default now(),
  primary key (circle_id, user_id)
);

-- Payments (all P2P transfers)
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid references users(id), -- null = external deposit (not sent via PayCircle)
  to_user_id uuid references users(id) not null,
  amount_usdc numeric(20,6) not null,
  fee_usdc numeric(20,6) default 0,
  note text,
  source_chain text default 'ARC',
  tx_hash text,
  cctp_nonce bigint,
  status text default 'completed'
    check (status in ('pending','completed','failed')),
  circle_id uuid references circles(id),
  created_at timestamptz default now()
);

-- Payment requests
create table if not exists payment_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid references users(id) not null,
  to_user_id uuid references users(id) not null,
  amount_usdc numeric(20,6) not null,
  note text,
  status text default 'pending'
    check (status in ('pending','paid','cancelled','rejected','expired')),
  payment_id uuid references payments(id),
  expires_at timestamptz default (now() + interval '7 days'),
  created_at timestamptz default now()
);

-- Bill splits
create table if not exists splits (
  id uuid primary key default gen_random_uuid(),
  contract_split_id text,
  creator_id uuid references users(id) not null,
  circle_id uuid references circles(id),
  total_amount_usdc numeric(20,6) not null,
  collected_usdc numeric(20,6) default 0,
  description text not null,
  status text default 'open'
    check (status in ('open','complete','cancelled')),
  deadline timestamptz,
  created_at timestamptz default now()
);

-- Split members
create table if not exists split_members (
  split_id uuid references splits(id) not null,
  user_id uuid references users(id) not null,
  amount_owed_usdc numeric(20,6) not null,
  paid boolean default false,
  payment_id uuid references payments(id),
  paid_at timestamptz,
  primary key (split_id, user_id)
);

-- Goal pools (group savings — variable contributions toward a shared
-- target, held in GoalPool.sol on-chain; withdrawal requires every member
-- to approve, unlike splits' fixed-share auto-release).
create table if not exists circle_goals (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references circles(id) not null,
  contract_goal_id text unique, -- bytes32 goalId from GoalPool.createGoal, set once confirmed on-chain
  creator_id uuid references users(id) not null,
  target_amount_usdc numeric(20,6) not null,
  collected_usdc numeric(20,6) default 0,
  description text not null,
  status text default 'open'
    check (status in ('open','withdrawn','cancelled')),
  created_at timestamptz default now()
);

-- Goal members — everyone allowed to contribute and required to approve
-- a withdrawal. Membership is fixed at goal creation (must match the
-- on-chain member list passed to GoalPool.createGoal).
create table if not exists goal_members (
  goal_id uuid references circle_goals(id) not null,
  user_id uuid references users(id) not null,
  primary key (goal_id, user_id)
);

-- Individual contributions toward a goal (any member, any amount, any
-- number of times).
create table if not exists goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references circle_goals(id) not null,
  user_id uuid references users(id) not null,
  amount_usdc numeric(20,6) not null,
  tx_hash text,
  created_at timestamptz default now()
);

-- A request to withdraw the full pooled balance to a recipient. Only one
-- may be pending per goal at a time (enforced on-chain and mirrored here).
create table if not exists goal_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references circle_goals(id) not null,
  contract_withdrawal_id text unique, -- on-chain withdrawalId (uint256, as text)
  requested_by uuid references users(id) not null,
  recipient_user_id uuid references users(id) not null,
  amount_usdc numeric(20,6) not null,
  status text default 'pending'
    check (status in ('pending','executed','cancelled')),
  tx_hash text, -- set once the withdrawal executes on-chain
  created_at timestamptz default now()
);

-- One row per member who has approved a given withdrawal request.
create table if not exists goal_withdrawal_approvals (
  withdrawal_id uuid references goal_withdrawal_requests(id) not null,
  user_id uuid references users(id) not null,
  approved_at timestamptz default now(),
  primary key (withdrawal_id, user_id)
);

-- Bank accounts (saved for offramp; numbers AES-encrypted server-side)
create table if not exists bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  bank_name text not null,
  bank_code text not null,
  account_number_encrypted text not null,
  account_last4 text,
  account_name text not null,
  country text not null,
  currency text not null,
  is_default boolean default false,
  created_at timestamptz default now()
);

-- Offramp payouts
create table if not exists offramp_payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  amount_usdc numeric(20,6) not null,
  fee_usdc numeric(20,6) not null,
  net_usdc numeric(20,6) not null,
  target_currency text not null,
  expected_amount numeric(20,2),
  bank_account_id uuid references bank_accounts(id),
  yellow_card_payout_id text,
  deposit_tx_hash text unique, -- Arc tx that moved the user's USDC to the collection wallet; one payout per deposit
  status text default 'pending'
    check (status in ('pending','processing','completed','failed')),
  tracking_ref text,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Activity feed (denormalized for fast reads)
create table if not exists activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) not null,
  type text not null
    check (type in ('payment_sent','payment_received','request_received',
                    'request_paid','request_rejected','request_declined','split_created',
                    'split_paid','split_complete','offramp_completed','offramp_failed',
                    'circle_joined','goal_created','goal_target_reached',
                    'goal_withdrawal_requested','goal_withdrawn')),
  reference_id uuid,
  actor_id uuid references users(id),
  amount_usdc numeric(20,6),
  note text,
  read boolean default false,
  created_at timestamptz default now()
);

-- Atomic sender/recipient totals bump (called from /api/payments/send)
create or replace function increment_user_totals(
  sender_id uuid,
  recipient_id uuid,
  amount numeric
) returns void language sql as $$
  update users set total_sent = total_sent + amount where id = sender_id;
  update users set total_received = total_received + amount where id = recipient_id;
$$;

-- Indexes
create index if not exists idx_users_username on users(username);
create index if not exists idx_users_phone on users(phone);
create index if not exists idx_payments_from on payments(from_user_id);
create index if not exists idx_payments_to on payments(to_user_id);
create index if not exists idx_payments_created on payments(created_at desc);
create index if not exists idx_requests_to on payment_requests(to_user_id, status);
create index if not exists idx_splits_creator on splits(creator_id);
create index if not exists idx_activity_user on activity(user_id, created_at desc);
create index if not exists idx_activity_unread on activity(user_id, read);
create index if not exists idx_friendships_user on friendships(user_id);
create index if not exists idx_circle_goals_circle on circle_goals(circle_id);
create index if not exists idx_goal_contributions_goal on goal_contributions(goal_id);
create index if not exists idx_goal_withdrawal_requests_goal on goal_withdrawal_requests(goal_id);

-- RLS: the app uses the service-role key server-side; lock tables down for anon
alter table users enable row level security;
alter table friendships enable row level security;
alter table circles enable row level security;
alter table circle_members enable row level security;
alter table payments enable row level security;
alter table payment_requests enable row level security;
alter table splits enable row level security;
alter table split_members enable row level security;
alter table bank_accounts enable row level security;
alter table offramp_payouts enable row level security;
alter table activity enable row level security;
alter table circle_goals enable row level security;
alter table goal_members enable row level security;
alter table goal_contributions enable row level security;
alter table goal_withdrawal_requests enable row level security;
alter table goal_withdrawal_approvals enable row level security;

-- Authenticated users may read their own activity/payments directly (Realtime)
create policy "own activity" on activity for select using (auth.uid() = user_id);
create policy "own payments" on payments for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);
create policy "own requests" on payment_requests for select
  using (auth.uid() = from_user_id or auth.uid() = to_user_id);
create policy "public profiles" on users for select using (true);
create policy "goal members can read" on circle_goals for select
  using (exists (
    select 1 from goal_members where goal_members.goal_id = circle_goals.id and goal_members.user_id = auth.uid()
  ));
create policy "goal contributions readable by goal members" on goal_contributions for select
  using (exists (
    select 1 from goal_members where goal_members.goal_id = goal_contributions.goal_id and goal_members.user_id = auth.uid()
  ));
create policy "goal withdrawals readable by goal members" on goal_withdrawal_requests for select
  using (exists (
    select 1 from goal_members
    where goal_members.goal_id = goal_withdrawal_requests.goal_id and goal_members.user_id = auth.uid()
  ));

-- Realtime
alter publication supabase_realtime add table activity;
alter publication supabase_realtime add table payments;
alter publication supabase_realtime add table payment_requests;
alter publication supabase_realtime add table split_members;
alter publication supabase_realtime add table offramp_payouts;
alter publication supabase_realtime add table circle_goals;
alter publication supabase_realtime add table goal_contributions;
alter publication supabase_realtime add table goal_withdrawal_requests;
alter publication supabase_realtime add table goal_withdrawal_approvals;
