-- Cash-outs are now funded: the user's USDC must reach the platform's
-- collection wallet before a Yellow Card payout is requested. This records
-- the Arc transaction that funded each payout, and its uniqueness stops one
-- transfer from being used to fund more than one payout. Run once in the
-- Supabase SQL editor against an existing database (schema.sql already
-- reflects this for fresh installs).

alter table offramp_payouts add column if not exists deposit_tx_hash text;

-- Unique indexes ignore NULLs, so payouts created before this migration are unaffected.
create unique index if not exists offramp_payouts_deposit_tx_hash_key
  on offramp_payouts (deposit_tx_hash);
