-- Group savings pools: variable contributions toward a shared target,
-- held in GoalPool.sol on-chain, released only once every member approves
-- a withdrawal request. Run once in the Supabase SQL editor against an
-- existing database. (schema.sql already reflects this for fresh installs.)

create table if not exists circle_goals (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references circles(id) not null,
  contract_goal_id text unique,
  creator_id uuid references users(id) not null,
  target_amount_usdc numeric(20,6) not null,
  collected_usdc numeric(20,6) default 0,
  description text not null,
  status text default 'open'
    check (status in ('open','withdrawn','cancelled')),
  created_at timestamptz default now()
);

create table if not exists goal_members (
  goal_id uuid references circle_goals(id) not null,
  user_id uuid references users(id) not null,
  primary key (goal_id, user_id)
);

create table if not exists goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references circle_goals(id) not null,
  user_id uuid references users(id) not null,
  amount_usdc numeric(20,6) not null,
  tx_hash text,
  created_at timestamptz default now()
);

create table if not exists goal_withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references circle_goals(id) not null,
  contract_withdrawal_id text unique,
  requested_by uuid references users(id) not null,
  recipient_user_id uuid references users(id) not null,
  amount_usdc numeric(20,6) not null,
  status text default 'pending'
    check (status in ('pending','executed','cancelled')),
  tx_hash text,
  created_at timestamptz default now()
);

create table if not exists goal_withdrawal_approvals (
  withdrawal_id uuid references goal_withdrawal_requests(id) not null,
  user_id uuid references users(id) not null,
  approved_at timestamptz default now(),
  primary key (withdrawal_id, user_id)
);

alter table activity drop constraint activity_type_check;
alter table activity add constraint activity_type_check
  check (type in ('payment_sent','payment_received','request_received',
                  'request_paid','request_rejected','request_declined','split_created',
                  'split_paid','split_complete','offramp_completed','offramp_failed',
                  'circle_joined','goal_created','goal_target_reached',
                  'goal_withdrawal_requested','goal_withdrawn'));

create index if not exists idx_circle_goals_circle on circle_goals(circle_id);
create index if not exists idx_goal_contributions_goal on goal_contributions(goal_id);
create index if not exists idx_goal_withdrawal_requests_goal on goal_withdrawal_requests(goal_id);

alter table circle_goals enable row level security;
alter table goal_members enable row level security;
alter table goal_contributions enable row level security;
alter table goal_withdrawal_requests enable row level security;
alter table goal_withdrawal_approvals enable row level security;

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

alter publication supabase_realtime add table circle_goals;
alter publication supabase_realtime add table goal_contributions;
alter publication supabase_realtime add table goal_withdrawal_requests;
alter publication supabase_realtime add table goal_withdrawal_approvals;
