-- Rival X Seamless Match Hub
-- Run once in Supabase SQL Editor.
-- Safe to re-run.

create table if not exists public.match_rooms (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round text not null default 'Round 1',
  player1_id uuid not null references public.players(id) on delete cascade,
  player2_id uuid not null references public.players(id) on delete cascade,
  status text not null default 'ready'
    check (status in ('ready','live','result_pending','completed','disputed','cancelled')),
  started_at timestamptz,
  player1_report text,
  player2_report text,
  player1_score integer,
  player2_score integer,
  winner_id uuid references public.players(id),
  loser_id uuid references public.players(id),
  dispute_reason text,
  created_at timestamptz default now()
);

alter table public.match_rooms enable row level security;

drop policy if exists "Match rooms are publicly viewable" on public.match_rooms;
create policy "Match rooms are publicly viewable"
  on public.match_rooms for select
  using (true);

drop policy if exists "Admins can create match rooms" on public.match_rooms;
create policy "Admins can create match rooms"
  on public.match_rooms for insert
  with check (public.is_rivalx_admin());

drop policy if exists "Admins can manage match rooms" on public.match_rooms;
create policy "Admins can manage match rooms"
  on public.match_rooms for update
  using (public.is_rivalx_admin());

drop policy if exists "Admins can delete match rooms" on public.match_rooms;
create policy "Admins can delete match rooms"
  on public.match_rooms for delete
  using (public.is_rivalx_admin());

create index if not exists match_rooms_tournament_idx
  on public.match_rooms(tournament_id, round);

create index if not exists match_rooms_player1_idx
  on public.match_rooms(player1_id, status);

create index if not exists match_rooms_player2_idx
  on public.match_rooms(player2_id, status);

create or replace function public.generate_match_rooms(p_tournament_id uuid, p_round text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  player_ids uuid[];
  previous_round text;
  pair_count integer := 0;
  i integer;
  p1 uuid;
  p2 uuid;
begin
  if not public.is_rivalx_admin() then
    raise exception 'Only Rival X administrators can generate matches';
  end if;

  previous_round := case p_round
    when 'Round of 32' then 'Round of 64'
    when 'Round of 16' then 'Round of 32'
    when 'Quarter Finals' then 'Round of 16'
    when 'Semi Finals' then 'Quarter Finals'
    when 'Final' then 'Semi Finals'
    else null
  end;

  if previous_round is null then
    select array_agg(e.player_id order by e.created_at, e.player_id)
      into player_ids
    from public.entries e
    where e.tournament_id = p_tournament_id
      and e.payment_status = 'paid'
      and e.application_status <> 'rejected'
      and not exists (
        select 1
        from public.match_rooms r
        where r.tournament_id = p_tournament_id
          and r.round = p_round
          and (r.player1_id = e.player_id or r.player2_id = e.player_id)
          and r.status <> 'cancelled'
      );
  else
    select array_agg(r.winner_id order by r.created_at, r.winner_id)
      into player_ids
    from public.match_rooms r
    where r.tournament_id = p_tournament_id
      and r.round = previous_round
      and r.status = 'completed'
      and r.winner_id is not null
      and not exists (
        select 1
        from public.match_rooms next_room
        where next_room.tournament_id = p_tournament_id
          and next_room.round = p_round
          and (next_room.player1_id = r.winner_id or next_room.player2_id = r.winner_id)
          and next_room.status <> 'cancelled'
      );
  end if;

  if player_ids is null or array_length(player_ids, 1) < 2 then
    return 0;
  end if;

  for i in 1..floor(array_length(player_ids, 1) / 2)::integer loop
    p1 := player_ids[(i * 2) - 1];
    p2 := player_ids[i * 2];

    insert into public.match_rooms (tournament_id, round, player1_id, player2_id, status)
    values (p_tournament_id, p_round, p1, p2, 'ready');

    pair_count := pair_count + 1;
  end loop;

  return pair_count;
end;
$$;

create or replace function public.start_match_room(p_match_id uuid)
returns public.match_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  room public.match_rooms;
begin
  select * into room
  from public.match_rooms
  where id = p_match_id
  for update;

  if room.id is null then
    raise exception 'Match room not found';
  end if;

  if auth.uid() <> room.player1_id and auth.uid() <> room.player2_id and not public.is_rivalx_admin() then
    raise exception 'You are not a participant in this match';
  end if;

  if room.status not in ('ready','result_pending') then
    return room;
  end if;

  update public.match_rooms
  set status = 'live',
      started_at = coalesce(started_at, now())
  where id = p_match_id
  returning * into room;

  return room;
end;
$$;

create or replace function public.submit_match_room_result(
  p_match_id uuid,
  p_player1_score integer,
  p_player2_score integer
)
returns public.match_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  room public.match_rooms;
  my_report text;
  first_score integer;
  second_score integer;
  winner uuid;
  loser uuid;
  opponent_name text;
begin
  if p_player1_score < 0 or p_player1_score > 99 or p_player2_score < 0 or p_player2_score > 99 then
    raise exception 'Scores must be between 0 and 99';
  end if;

  select * into room
  from public.match_rooms
  where id = p_match_id
  for update;

  if room.id is null then
    raise exception 'Match room not found';
  end if;

  if auth.uid() <> room.player1_id and auth.uid() <> room.player2_id and not public.is_rivalx_admin() then
    raise exception 'You are not a participant in this match';
  end if;

  if room.status in ('completed','cancelled') then
    return room;
  end if;

  my_report := p_player1_score::text || '-' || p_player2_score::text;

  if auth.uid() = room.player1_id then
    update public.match_rooms
    set player1_report = my_report,
        status = case when player2_report is null then 'result_pending' else status end
    where id = p_match_id
    returning * into room;
  elsif auth.uid() = room.player2_id then
    update public.match_rooms
    set player2_report = my_report,
        status = case when player1_report is null then 'result_pending' else status end
    where id = p_match_id
    returning * into room;
  else
    raise exception 'Only match participants can submit a result';
  end if;

  if room.player1_report is null or room.player2_report is null then
    return room;
  end if;

  if room.player1_report <> room.player2_report then
    update public.match_rooms
    set status = 'disputed',
        dispute_reason = 'Players submitted different scores. Admin review required.'
    where id = p_match_id
    returning * into room;
    return room;
  end if;

  first_score := split_part(room.player1_report, '-', 1)::integer;
  second_score := split_part(room.player1_report, '-', 2)::integer;

  if first_score = second_score then
    update public.match_rooms
    set status = 'disputed',
        dispute_reason = 'Draw reported. This knockout room requires a winner.'
    where id = p_match_id
    returning * into room;
    return room;
  end if;

  winner := case when first_score > second_score then room.player1_id else room.player2_id end;
  loser := case when first_score > second_score then room.player2_id else room.player1_id end;

  update public.match_rooms
  set status = 'completed',
      player1_score = first_score,
      player2_score = second_score,
      winner_id = winner,
      loser_id = loser,
      dispute_reason = null
  where id = p_match_id
  returning * into room;

  select tag into opponent_name
  from public.players
  where id = room.player2_id;

  insert into public.matches (
    tournament_id,
    player_id,
    player2_id,
    opponent_tag,
    result,
    score,
    round,
    stage,
    winner_id,
    eliminated_id,
    played_at
  )
  select
    room.tournament_id,
    room.player1_id,
    room.player2_id,
    coalesce(opponent_name, 'Opponent'),
    case when first_score > second_score then 'W' else 'L' end,
    first_score::text || '-' || second_score::text,
    room.round,
    room.round,
    winner,
    loser,
    now()
  where not exists (
    select 1 from public.matches m
    where m.tournament_id = room.tournament_id
      and m.player_id = room.player1_id
      and m.player2_id = room.player2_id
      and m.round = room.round
      and m.played_at >= room.created_at
  );

  return room;
end;
$$;

create or replace function public.resolve_match_room(
  p_match_id uuid,
  p_player1_score integer,
  p_player2_score integer
)
returns public.match_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  room public.match_rooms;
  winner uuid;
  loser uuid;
  opponent_name text;
begin
  if not public.is_rivalx_admin() then
    raise exception 'Only Rival X administrators can resolve disputes';
  end if;

  if p_player1_score < 0 or p_player1_score > 99 or p_player2_score < 0 or p_player2_score > 99 then
    raise exception 'Scores must be between 0 and 99';
  end if;

  if p_player1_score = p_player2_score then
    raise exception 'A knockout match must have a winner';
  end if;

  select * into room from public.match_rooms where id = p_match_id for update;
  if room.id is null then raise exception 'Match room not found'; end if;

  winner := case when p_player1_score > p_player2_score then room.player1_id else room.player2_id end;
  loser := case when p_player1_score > p_player2_score then room.player2_id else room.player1_id end;

  update public.match_rooms
  set status = 'completed',
      player1_score = p_player1_score,
      player2_score = p_player2_score,
      winner_id = winner,
      loser_id = loser,
      dispute_reason = null
  where id = p_match_id
  returning * into room;

  select tag into opponent_name from public.players where id = room.player2_id;

  insert into public.matches (
    tournament_id, player_id, player2_id, opponent_tag, result, score,
    round, stage, winner_id, eliminated_id, played_at
  )
  select
    room.tournament_id, room.player1_id, room.player2_id, coalesce(opponent_name, 'Opponent'),
    case when p_player1_score > p_player2_score then 'W' else 'L' end,
    p_player1_score::text || '-' || p_player2_score::text,
    room.round, room.round, winner, loser, now()
  where not exists (
    select 1 from public.matches m
    where m.tournament_id = room.tournament_id
      and m.player_id = room.player1_id
      and m.player2_id = room.player2_id
      and m.round = room.round
      and m.played_at >= room.created_at
  );

  return room;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'match_rooms'
  ) then
    alter publication supabase_realtime add table public.match_rooms;
  end if;
end
$$;
