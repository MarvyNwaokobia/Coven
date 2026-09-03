-- Bill splits held in SplitEscrow. contract_split_id (the on-chain id) already exists on splits; a
-- split is now recorded once per on-chain id, and a member who claimed their refund after a
-- cancelled or expired split is marked so the UI stops offering it. Run once in the Supabase SQL
-- editor against an existing database (schema.sql already reflects this for fresh installs).

create unique index if not exists splits_contract_split_id_key on splits (contract_split_id);

alter table split_members add column if not exists refunded_at timestamptz;
