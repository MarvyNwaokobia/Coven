-- One on-chain transaction can be recorded once. Confirm routes match "the most recent transfer
-- from this wallet for this amount", which does not identify a transaction, so without this a
-- single transfer could be recorded repeatedly (extra "you received" notices, several requests or
-- split shares marked paid by one payment). NULL hashes stay allowed: unique indexes treat NULLs as
-- distinct. Run once in the Supabase SQL editor against an existing database (schema.sql already
-- reflects this for fresh installs). It fails if duplicate hashes already exist; none did when
-- this was written.

create unique index if not exists payments_tx_hash_key on payments (tx_hash);
create unique index if not exists goal_contributions_tx_hash_key on goal_contributions (tx_hash);
