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
  verification_badge text not null default 'none' check (verification_badge in ('none', 'blue', 'red', 'gold')),
  referral_code text unique not null default ('RX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  last_active_at timestamptz not null default now(),
  created_at timestamptz default now()
);

create or replace function public.create_player_for_auth_user(
  p_user_id uuid,
  p_email text,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  player_tag text;
begin
  player_tag := nullif(pg_catalog.btrim(p_metadata ->> 'username'), '');
  if player_tag is null then
    player_tag := nullif(pg_catalog.split_part(p_email, '@', 1), '');
  end if;
  if player_tag is null then
    player_tag := 'Player';
  end if;

  if exists (
    select 1
    from public.players
    where pg_catalog.lower(tag) = pg_catalog.lower(player_tag)
      and id <> p_user_id
  ) then
    player_tag := player_tag || '-' || pg_catalog.left(p_user_id::text, 8);
  end if;

  begin
    insert into public.players (id, tag)
    values (p_user_id, player_tag)
    on conflict (id) do nothing;
  exception
    when unique_violation then
      insert into public.players (id, tag)
      values (p_user_id, player_tag || '-' || pg_catalog.replace(p_user_id::text, '-', ''))
      on conflict (id) do nothing;
  end;
end;
$$;

revoke all on function public.create_player_for_auth_user(uuid, text, jsonb)
  from public, anon, authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.create_player_for_auth_user(new.id, new.email, new.raw_user_meta_data);
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user()
  from public, anon, authenticated;

drop trigger if exists on_auth_user_created_create_player on auth.users;
create trigger on_auth_user_created_create_player
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

alter table players enable row level security;

-- Only signed-in members can read the fields used by profiles and rankings.
drop policy if exists "Players are publicly viewable" on players;
create policy "Public profile identity is viewable"
  on players for select
  using (true);
create policy "Authenticated members can view players"
  on players for select
  using (auth.uid() is not null);

revoke select on table players from public, anon, authenticated;
grant select (id, tag, avatar_url, squad_photo_url)
  on table players to anon;
grant select (id, tag, avatar_url, squad_photo_url, win_streak, verification_badge, created_at)
  on table players to authenticated;

-- A player can only create/edit their own row.
create policy "Players can insert their own row"
  on players for insert
  with check (auth.uid() = id);

create policy "Players can update their own row"
  on players for update
  using (auth.uid() = id);

create policy "Admin can manage player verification"
  on players for update
  using (public.is_rivalx_admin());

create or replace function public.guard_player_verification_fields()
returns trigger
language plpgsql
as $
begin
  if not public.is_rivalx_admin() and new.verification_badge is distinct from old.verification_badge then
    raise exception 'Only Rival X administrators can change verification badges';
  end if;
  return new;
end;
$;

create trigger protect_player_verification_badge
before update on players
for each row
execute function public.guard_player_verification_fields();

create or replace function public.guard_player_referral_fields()
returns trigger
language plpgsql
as $
begin
  if not public.is_rivalx_admin()
     and (
       new.referral_code is distinct from old.referral_code
       or new.last_active_at is distinct from old.last_active_at
     ) then
    raise exception 'Referral ID and activity status are managed by Rival X';
  end if;
  return new;
end;
$;

create trigger protect_player_referral_fields
before update on players
for each row
execute function public.guard_player_referral_fields();

create table referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references players(id) on delete cascade,
  referred_id uuid not null unique references players(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (referrer_id <> referred_id)
);

alter table referrals enable row level security;

create policy "Players can view their own referrals"
  on referrals for select
  using (auth.uid() = referrer_id or auth.uid() = referred_id);

create index referrals_referrer_idx on referrals(referrer_id);

create or replace function public.touch_player_activity()
returns void
language sql
security definer
set search_path = public
as $
  update players set last_active_at = now() where id = auth.uid();
$;

create or replace function public.record_referral(p_referral_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $
declare
  referrer uuid;
  me uuid := auth.uid();
begin
  if me is null or p_referral_code is null or trim(p_referral_code) = '' then
    return false;
  end if;

  select id into referrer
  from players
  where upper(referral_code) = upper(trim(p_referral_code))
  limit 1;

  if referrer is null or referrer = me then
    return false;
  end if;

  insert into referrals (referrer_id, referred_id)
  values (referrer, me)
  on conflict (referred_id) do nothing;

  return true;
end;
$;

-- Publicly exposes only which players have unlocked the referral
-- qualification, not the identities of their referrals.
create or replace function public.get_referral_qualified_players()
returns table (player_id uuid)
language sql
security definer
set search_path = public
as $
  select r.referrer_id
  from referrals r
  join players p on p.id = r.referred_id
  group by r.referrer_id
  having
    count(*) filter (where p.last_active_at >= now() - interval '90 days') >= 100
    and
    count(*) filter (
      where p.last_active_at >= now() - interval '90 days'
        and exists (
          select 1 from matches m
          where m.player_id = r.referred_id
             or m.player2_id = r.referred_id
             or m.winner_id = r.referred_id
             or m.eliminated_id = r.referred_id
        )
    ) >= ceil(count(*) filter (
      where p.last_active_at >= now() - interval '90 days'
    ) * 0.60);
$;

create or replace function public.get_my_referral_stats()
returns table (
  referral_code text,
  total_referrals integer,
  active_referrals integer,
  tournament_players integer,
  active_play_rate integer,
  qualifies_for_referral_blue boolean
)
language sql
security definer
set search_path = public
as $
  with my_refs as (
    select
      r.referred_id,
      p.last_active_at,
      exists (
        select 1 from matches m
        where m.player_id = r.referred_id
           or m.player2_id = r.referred_id
           or m.winner_id = r.referred_id
           or m.eliminated_id = r.referred_id
      ) as has_played
    from referrals r
    join players p on p.id = r.referred_id
    where r.referrer_id = auth.uid()
  ),
  stats as (
    select
      count(*)::integer as total_referrals,
      count(*) filter (where last_active_at >= now() - interval '90 days')::integer as active_referrals,
      count(*) filter (
        where last_active_at >= now() - interval '90 days' and has_played
      )::integer as tournament_players
    from my_refs
  )
  select
    p.referral_code,
    s.total_referrals,
    s.active_referrals,
    s.tournament_players,
    case when s.active_referrals = 0 then 0
         else floor((s.tournament_players::numeric / s.active_referrals::numeric) * 100)::integer
    end as active_play_rate,
    (s.active_referrals >= 100
      and s.tournament_players >= ceil(s.active_referrals * 0.60)) as qualifies_for_referral_blue
  from players p
  cross join stats s
  where p.id = auth.uid();
$;


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
  with check (public.is_rivalx_admin());

create policy "Only admin can update tournaments"
  on tournaments for update
  using (public.is_rivalx_admin() or created_by = auth.uid());

create policy "Only admin can delete tournaments"
  on tournaments for delete
  using (public.is_rivalx_admin() or created_by = auth.uid());



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
  payment_method text not null default 'paystack' check (payment_method in ('paystack', 'bank_transfer', 'free')),
  payment_reference text,
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

create policy "Players can insert their own free paid entry"
  on entries for insert
  with check (
    auth.uid() = player_id
    and payment_status = 'paid'
    and application_status = 'pending'
    and exists (
      select 1
      from tournaments t
      where t.id = tournament_id
        and t.entry_fee = 0
        and t.status = 'open'
    )
  );

-- Admin can update entries (to confirm/reject applications).
-- The webhook function (service_role) can also change payment_status.
create policy "Admin can update entries"
  on entries for update
  using (public.is_rivalx_admin());


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

drop policy if exists "Matches are publicly viewable" on matches;
create policy "Authenticated members can view matches"
  on matches for select
  using (auth.uid() is not null);

revoke select on table matches from public, anon, authenticated;
grant select (
  id, tournament_id, player_id, player2_id, opponent_tag, result, score,
  round, stage, winner_id, eliminated_id, played_at
) on table matches to authenticated;

create policy "Only admin can insert matches"
  on matches for insert
  with check (public.is_rivalx_admin());

create policy "Only admin can update matches"
  on matches for update
  using (public.is_rivalx_admin());


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
  with check (public.is_rivalx_admin());

create policy "Only admin can delete MVP moments"
  on mvp_moments for delete
  using (public.is_rivalx_admin());