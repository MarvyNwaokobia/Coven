-- Allows payments.from_user_id to be null, representing an external
-- deposit (a transfer into a Circle wallet that didn't originate from
-- another PayCircle user via our own send/request/split/cashout flows).
-- Run this once in the Supabase SQL editor against an existing database.
-- (schema.sql already reflects this for fresh installs.)

alter table payments alter column from_user_id drop not null;
