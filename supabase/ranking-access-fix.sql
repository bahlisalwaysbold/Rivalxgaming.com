-- Ensure every auth account has a player row and restrict ranking data
-- to authenticated members. Safe to run more than once.

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

-- Repair auth accounts created before the trigger was installed.
do $$
declare
  auth_user record;
begin
  for auth_user in
    select u.id, u.email, u.raw_user_meta_data
    from auth.users u
    left join public.players p on p.id = u.id
    where p.id is null
  loop
    perform public.create_player_for_auth_user(
      auth_user.id,
      auth_user.email,
      auth_user.raw_user_meta_data
    );
  end loop;
end;
$$;

alter table public.players enable row level security;
drop policy if exists "Players are publicly viewable" on public.players;
drop policy if exists "Public profile identity is viewable" on public.players;
create policy "Public profile identity is viewable"
  on public.players for select
  using (true);
drop policy if exists "Authenticated members can view players" on public.players;
create policy "Authenticated members can view players"
  on public.players for select
  using (auth.uid() is not null);

revoke select on table public.players from public, anon, authenticated;
grant select (id, tag, avatar_url, squad_photo_url)
  on table public.players to anon;
grant select (id, tag, avatar_url, squad_photo_url, win_streak, verification_badge, created_at)
  on table public.players to authenticated;

alter table public.matches enable row level security;
drop policy if exists "Matches are publicly viewable" on public.matches;
drop policy if exists "Authenticated members can view matches" on public.matches;
create policy "Authenticated members can view matches"
  on public.matches for select
  using (auth.uid() is not null);

revoke select on table public.matches from public, anon, authenticated;
grant select (
  id, tournament_id, player_id, player2_id, opponent_tag, result, score,
  round, stage, winner_id, eliminated_id, played_at
) on table public.matches to authenticated;
