-- Rival X database schema
-- Run this in Supabase: Dashboard → SQL Editor → paste this whole file → Run

-- ─────────────────────────────────────────────
-- PLAYERS
-- One row per registered account. Linked to Supabase's own auth
-- system, so you never handle passwords yourself.
-- ─────────────────────────────────────────────
create table players (
  id uuid primary key references auth.users(id) on delete cascade,
  tag text unique not null,
  avatar_url text,
  squad_photo_url text,
  win_streak integer default 0,
  created_at timestamptz default now()
);

alter table players enable row level security;

-- Anyone can view player tags/avatars (needed for the public
-- leaderboard and profile pages).
create policy "Players are publicly viewable"
  on players for select
  using (true);

-- A player can only create/edit their own row.
create policy "Players can insert their own row"
  on players for insert
  with check (auth.uid() = id);

create policy "Players can update their own row"
  on players for update
  using (auth.uid() = id);


-- ─────────────────────────────────────────────
-- TOURNAMENTS
-- Created by you (the admin) only. Publicly readable so the
-- Tournaments and Home pages can list them.
-- ─────────────────────────────────────────────
create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  game text default 'eFootball',
  entry_fee integer not null,        -- in Naira
  format text,
  slots integer not null,
  start_date date,
  registration_deadline timestamptz,
  registration_start timestamptz,
  tournament_days integer default 1,
  status text default 'open' check (status in ('open', 'live', 'completed', 'cancelled')),
  bracket_data jsonb,
  rules text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table tournaments enable row level security;

create policy "Tournaments are publicly viewable"
  on tournaments for select
  using (true);

-- Only you can create tournaments. Replace the UUID below with
-- your own user id (find it in Supabase → Authentication → Users
-- after you've registered your own account).
create policy "Only admin can insert tournaments"
  on tournaments for insert
  with check (auth.uid() = '1164535d-5949-49e6-abb6-5ad30921fd21');

create policy "Only admin can update tournaments"
  on tournaments for update
  using (auth.uid() = '1164535d-5949-49e6-abb6-5ad30921fd21');

create policy "Only admin can delete tournaments"
  on tournaments for delete
  using (auth.uid() = '1164535d-5949-49e6-abb6-5ad30921fd21');



-- ─────────────────────────────────────────────
-- ENTRIES
-- Links a player to a tournament with a payment status.
-- payment_status starts as 'pending' and can ONLY be flipped to
-- 'paid' by the webhook function (using the service_role key,
-- which bypasses RLS) — never directly by a logged-in player.
-- This is what makes the payment flow scam-proof: a player
-- cannot mark their own entry as paid from the browser.
-- ─────────────────────────────────────────────
create table entries (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id) on delete cascade,
  tournament_id uuid references tournaments(id) on delete cascade,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed')),
  application_status text default 'pending' check (application_status in ('pending', 'confirmed', 'rejected')),
  paystack_ref text unique not null,
  created_at timestamptz default now()
);

alter table entries enable row level security;

-- Anyone can view entries (needed for public tournament brackets
-- showing who's playing). Players can also see their own entries.
create policy "Entries are publicly viewable"
  on entries for select
  using (true);

-- Players can create a pending entry for themselves (before paying).
create policy "Players can insert their own pending entry"
  on entries for insert
  with check (auth.uid() = player_id and payment_status = 'pending');

-- Admin can update entries (to confirm/reject applications).
-- The webhook function (service_role) can also change payment_status.
create policy "Admin can update entries"
  on entries for update
  using (auth.uid() = '1164535d-5949-49e6-abb6-5ad30921fd21');


-- ─────────────────────────────────────────────
-- MATCHES
-- Results entered by you after each match. Publicly readable so
-- profiles and the leaderboard can show real stats.
-- ─────────────────────────────────────────────
create table matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references tournaments(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  player2_id uuid references players(id) on delete cascade,
  opponent_tag text,
  result text check (result in ('W', 'L')),
  score text,
  round text,
  stage text,
  winner_id uuid references players(id),
  eliminated_id uuid references players(id),
  played_at timestamptz default now()
);

alter table matches enable row level security;

create policy "Matches are publicly viewable"
  on matches for select
  using (true);

create policy "Only admin can insert matches"
  on matches for insert
  with check (auth.uid() = '1164535d-5949-49e6-abb6-5ad30921fd21');

create policy "Only admin can update matches"
  on matches for update
  using (auth.uid() = '1164535d-5949-49e6-abb6-5ad30921fd21');


-- ─────────────────────────────────────────────
-- MVP MOMENTS
-- Admin posts highlight moments (goals, saves, etc.) from any user.
-- Publicly viewable so everyone can see and tap through to profiles.
-- ─────────────────────────────────────────────
create table mvp_moments (
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

create policy "MVP moments are publicly viewable"
  on mvp_moments for select
  using (true);

create policy "Only admin can insert MVP moments"
  on mvp_moments for insert
  with check (auth.uid() = '1164535d-5949-49e6-abb6-5ad30921fd21');

create policy "Only admin can delete MVP moments"
  on mvp_moments for delete
  using (auth.uid() = '1164535d-5949-49e6-abb6-5ad30921fd21');