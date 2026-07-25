-- Adds a 'rejected' payment_request status (distinct from 'cancelled',
-- which means the requester withdrew it — 'rejected' means the payer
-- explicitly declined) and two matching activity types: 'request_rejected'
-- (shown to the original requester) and 'request_declined' (shown to the
-- person who declined, confirming their own action — same two-perspective
-- pattern as payment_sent/payment_received). Run once in the Supabase SQL
-- editor against an existing database. (schema.sql already reflects this
-- for fresh installs.)

alter table payment_requests drop constraint payment_requests_status_check;
alter table payment_requests add constraint payment_requests_status_check
  check (status in ('pending','paid','cancelled','rejected','expired'));

alter table activity drop constraint activity_type_check;
alter table activity add constraint activity_type_check
  check (type in ('payment_sent','payment_received','request_received',
                  'request_paid','request_rejected','request_declined','split_created',
                  'split_paid','split_complete','offramp_completed','offramp_failed',
                  'circle_joined'));
