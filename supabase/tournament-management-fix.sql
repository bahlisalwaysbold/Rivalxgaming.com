-- Rival X tournament management + free-entry fix
-- Run once in Supabase SQL Editor against the existing project.
-- This is safe to re-run.

create or replace function public.is_rivalx_admin()
returns boolean
language sql
stable
as $$
  select
    auth.uid() = '1164535d-5949-49e6-abb6-5ad30921fd21'::uuid
    or coalesce(auth.jwt()->'app_metadata'->>'role', '') = 'admin';
$$;

alter table public.tournaments enable row level security;

drop policy if exists "Tournaments are publicly viewable" on public.tournaments;
create policy "Tournaments are publicly viewable"
  on public.tournaments for select
  using (true);

drop policy if exists "Only admin can insert tournaments" on public.tournaments;
create policy "Only admin can insert tournaments"
  on public.tournaments for insert
  with check (public.is_rivalx_admin());

drop policy if exists "Only admin can update tournaments" on public.tournaments;
create policy "Only admin can update tournaments"
  on public.tournaments for update
  using (public.is_rivalx_admin() or created_by = auth.uid());

drop policy if exists "Only admin can delete tournaments" on public.tournaments;
create policy "Only admin can delete tournaments"
  on public.tournaments for delete
  using (public.is_rivalx_admin() or created_by = auth.uid());

alter table public.entries enable row level security;

drop policy if exists "Players can insert their own free paid entry" on public.entries;
create policy "Players can insert their own free paid entry"
  on public.entries for insert
  with check (
    auth.uid() = player_id
    and payment_status = 'paid'
    and application_status = 'pending'
    and exists (
      select 1
      from public.tournaments t
      where t.id = tournament_id
        and t.entry_fee = 0
        and t.status = 'open'
    )
  );

drop policy if exists "Admin can update entries" on public.entries;
create policy "Admin can update entries"
  on public.entries for update
  using (public.is_rivalx_admin());

drop policy if exists "Only admin can insert matches" on public.matches;
create policy "Only admin can insert matches"
  on public.matches for insert
  with check (public.is_rivalx_admin());

drop policy if exists "Only admin can update matches" on public.matches;
create policy "Only admin can update matches"
  on public.matches for update
  using (public.is_rivalx_admin());

drop policy if exists "Only admin can insert MVP moments" on public.mvp_moments;
create policy "Only admin can insert MVP moments"
  on public.mvp_moments for insert
  with check (public.is_rivalx_admin());

drop policy if exists "Only admin can delete MVP moments" on public.mvp_moments;
create policy "Only admin can delete MVP moments"
  on public.mvp_moments for delete
  using (public.is_rivalx_admin());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'entries'
  ) then
    alter publication supabase_realtime add table public.entries;
  end if;
end
$$;
