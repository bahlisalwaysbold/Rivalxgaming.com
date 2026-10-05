-- Rival X account deletion + referral verification
-- Run once in Supabase SQL Editor.
-- Safe to re-run.

alter table public.players
  add column if not exists referral_code text;

alter table public.players
  add column if not exists last_active_at timestamptz not null default now();

update public.players
set referral_code = 'RX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
where referral_code is null;

alter table public.players
  alter column referral_code set default ('RX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)));

alter table public.players
  alter column referral_code set not null;

create unique index if not exists players_referral_code_uidx
  on public.players(referral_code);

create index if not exists players_last_active_idx
  on public.players(last_active_at);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.players(id) on delete cascade,
  referred_id uuid not null unique references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (referrer_id <> referred_id)
);

alter table public.referrals enable row level security;

drop policy if exists "Players can view their own referrals" on public.referrals;
create policy "Players can view their own referrals"
  on public.referrals for select
  using (auth.uid() = referrer_id or auth.uid() = referred_id);

create index if not exists referrals_referrer_idx
  on public.referrals(referrer_id);

create or replace function public.touch_player_activity()
returns void
language sql
security definer
set search_path = public
as $$
  update public.players
  set last_active_at = now()
  where id = auth.uid();
$$;

create or replace function public.record_referral(p_referral_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  referrer uuid;
  me uuid := auth.uid();
begin
  if me is null or p_referral_code is null or trim(p_referral_code) = '' then
    return false;
  end if;

  select id
    into referrer
  from public.players
  where upper(referral_code) = upper(trim(p_referral_code))
  limit 1;

  if referrer is null or referrer = me then
    return false;
  end if;

  insert into public.referrals (referrer_id, referred_id)
  values (referrer, me)
  on conflict (referred_id) do nothing;

  return true;
end;
$$;

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
as $$
  with my_refs as (
    select
      r.referred_id,
      p.last_active_at,
      exists (
        select 1
        from public.matches m
        where m.player_id = r.referred_id
           or m.player2_id = r.referred_id
           or m.winner_id = r.referred_id
           or m.eliminated_id = r.referred_id
      ) as has_played
    from public.referrals r
    join public.players p on p.id = r.referred_id
    where r.referrer_id = auth.uid()
  ),
  stats as (
    select
      count(*)::integer as total_referrals,
      count(*) filter (where last_active_at >= now() - interval '90 days')::integer as active_referrals,
      count(*) filter (
        where last_active_at >= now() - interval '90 days'
          and has_played
      )::integer as tournament_players
    from my_refs
  )
  select
    p.referral_code,
    s.total_referrals,
    s.active_referrals,
    s.tournament_players,
    case
      when s.active_referrals = 0 then 0
      else floor((s.tournament_players::numeric / s.active_referrals::numeric) * 100)::integer
    end as active_play_rate,
    (s.active_referrals >= 100 and s.tournament_players >= ceil(s.active_referrals * 0.60)) as qualifies_for_referral_blue
  from public.players p
  cross join stats s
  where p.id = auth.uid();
$$;

create or replace function public.get_referral_qualified_players()
returns table (player_id uuid)
language sql
security definer
set search_path = public
as $$
  select r.referrer_id
  from public.referrals r
  join public.players p on p.id = r.referred_id
  group by r.referrer_id
  having
    count(*) filter (
      where p.last_active_at >= now() - interval '90 days'
    ) >= 100
    and
    count(*) filter (
      where p.last_active_at >= now() - interval '90 days'
        and exists (
          select 1
          from public.matches m
          where m.player_id = r.referred_id
             or m.player2_id = r.referred_id
             or m.winner_id = r.referred_id
             or m.eliminated_id = r.referred_id
        )
    ) >= ceil(
      count(*) filter (
        where p.last_active_at >= now() - interval '90 days'
      ) * 0.60
    );
$$;

create or replace function public.guard_player_referral_fields()
returns trigger
language plpgsql
as $$
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
$$;

drop trigger if exists protect_player_referral_fields on public.players;
create trigger protect_player_referral_fields
before update on public.players
for each row
execute function public.guard_player_referral_fields();
