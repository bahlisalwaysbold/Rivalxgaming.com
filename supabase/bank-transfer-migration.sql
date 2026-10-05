-- Rival X temporary bank-transfer payments
-- Run once in Supabase SQL Editor after the existing Rival X migrations.
-- Safe to re-run.

alter table public.entries
  add column if not exists payment_method text not null default 'paystack';

alter table public.entries
  add column if not exists payment_reference text;

alter table public.entries
  drop constraint if exists entries_payment_method_check;

alter table public.entries
  add constraint entries_payment_method_check
  check (payment_method in ('paystack', 'bank_transfer', 'free'));

create index if not exists entries_payment_method_idx
  on public.entries(payment_method);

create index if not exists entries_payment_reference_idx
  on public.entries(payment_reference);
