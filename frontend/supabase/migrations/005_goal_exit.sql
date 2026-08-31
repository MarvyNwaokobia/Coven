-- Time-locked exit for goal pools (GoalPool v2). A member starts a countdown on-chain; the DB
-- mirrors it so the UI can show who started it and when the goal can be dissolved. Both columns
-- are written only from on-chain state. Run once in the Supabase SQL editor against an existing
-- database (schema.sql already reflects this for fresh installs).

alter table circle_goals add column if not exists dissolve_at timestamptz;
alter table circle_goals add column if not exists dissolve_initiator_id uuid references users(id);
