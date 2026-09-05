-- Rival X Database Migration
-- Run this in Supabase: Dashboard → SQL Editor → paste this whole file → Run
-- This ADDS new columns/tables to your EXISTING database without dropping anything.

-- ─────────────────────────────────────────────
-- PLAYERS: add new columns
-- ─────────────────────────────────────────────
alter table players
  add column if not exists squad_photo_url text,
  add column if not exists win_streak integer default 0;

-- ─────────────────────────────────────────────
-- TOURNAMENTS: add new columns
-- ─────────────────────────────────────────────
alter table tournaments
  add column if not exists registration_deadline timestamptz,
  add column if not exists registration_start timestamptz,
  add column if not exists tournament_days integer default 1,
  add column if not exists status text default 'open' check (status in ('open', 'live', 'completed', 'cancelled')),
  add column if not exists bracket_data jsonb;

-- ─────────────────────────────────────────────
-- ENTRIES: add application_status column
-- ─────────────────────────────────────────────
alter table entries
  add column if not exists application_status text default 'pending' check (application_status in ('pending', 'confirmed', 'rejected'));

-- ─────────────────────────────────────────────
-- MATCHES: add new columns
-- ─────────────────────────────────────────────
alter table matches
  add column if not exists player2_id uuid references players(id) on delete cascade,
  add column if not exists round text,
  add column if not exists stage text,
  add column if not exists winner_id uuid references players(id),
  add column if not exists eliminated_id uuid references players(id);

-- ─────────────────────────────────────────────
-- MVP MOMENTS: create new table
-- ─────────────────────────────────────────────
create table if not exists mvp_moments (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id) on delete cascade,
  title text not null,
  description text,
  media_url text,
  media_type text default 'video' check (media_type in ('video', 'image', 'link')),
  tournament_id uuid references tournaments(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table mvp_moments enable row level security;

-- Drop existing policies first (PostgreSQL doesn't support CREATE POLICY IF NOT EXISTS)
drop policy if exists "MVP moments are publicly viewable" on mvp_moments;
create policy "MVP moments are publicly viewable"
  on mvp_moments for select
  using (true);

drop policy if exists "Only admin can insert MVP moments" on mvp_moments;
create policy "Only admin can insert MVP moments"
  on mvp_moments for insert
  with check (auth.uid() = '1164535d-5949-49e6-abb6-5ad30921fd21');

drop policy if exists "Only admin can delete MVP moments" on mvp_moments;
create policy "Only admin can delete MVP moments"
  on mvp_moments for delete
  using (auth.uid() = '1164535d-5949-49e6-abb6-5ad30921fd21');

-- ─────────────────────────────────────────────
-- RLS POLICY UPDATES
-- ─────────────────────────────────────────────

-- Make entries publicly viewable (needed for public tournament brackets)
drop policy if exists "Players can view their own entries" on entries;
drop policy if exists "Entries are publicly viewable" on entries;
create policy "Entries are publicly viewable"
  on entries for select
  using (true);

-- Allow admin to update entries (confirm/reject applications)
drop policy if exists "Admin can update entries" on entries;
create policy "Admin can update entries"
  on entries for update
  using (auth.uid() = '1164535d-5949-49e6-abb6-5ad30921fd21');

-- Allow admin to update matches
drop policy if exists "Only admin can update matches" on matches;
create policy "Only admin can update matches"
  on matches for update
  using (auth.uid() = '1164535d-5949-49e6-abb6-5ad30921fd21');