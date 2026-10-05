-- Rival X player verification system
-- Run once in Supabase SQL Editor against the existing project.
-- Safe to re-run.

alter table public.players
  add column if not exists verification_badge text not null default 'none';

do $$
begin
  alter table public.players
    add constraint players_verification_badge_check
    check (verification_badge in ('none', 'blue', 'red', 'gold'));
exception
  when duplicate_object then null;
end
$$;

alter table public.players enable row level security;

drop policy if exists "Admin can manage player verification" on public.players;
create policy "Admin can manage player verification"
  on public.players for update
  using (public.is_rivalx_admin());

create or replace function public.guard_player_verification_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_rivalx_admin() and new.verification_badge is distinct from old.verification_badge then
    raise exception 'Only Rival X administrators can change verification badges';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_player_verification_badge on public.players;
create trigger protect_player_verification_badge
before update on public.players
for each row
execute function public.guard_player_verification_fields();
