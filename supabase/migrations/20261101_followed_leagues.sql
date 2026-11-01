create table if not exists public.followed_leagues (
  user_id     uuid not null references auth.users(id) on delete cascade,
  league_id   bigint not null,
  league_name text not null check (char_length(league_name) between 1 and 100),
  country     text not null check (char_length(country) between 1 and 100),
  logo        text,
  created_at  timestamptz not null default now(),
  primary key (user_id, league_id)
);

alter table public.followed_leagues enable row level security;

drop policy if exists "followed_leagues_select_own" on public.followed_leagues;
drop policy if exists "followed_leagues_insert_own" on public.followed_leagues;
drop policy if exists "followed_leagues_update_own" on public.followed_leagues;
drop policy if exists "followed_leagues_delete_own" on public.followed_leagues;

create policy "followed_leagues_select_own"
  on public.followed_leagues for select to authenticated
  using (auth.uid() = user_id);
create policy "followed_leagues_insert_own"
  on public.followed_leagues for insert to authenticated
  with check (auth.uid() = user_id);
create policy "followed_leagues_update_own"
  on public.followed_leagues for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "followed_leagues_delete_own"
  on public.followed_leagues for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.followed_leagues from anon;
grant select, insert, update, delete on public.followed_leagues to authenticated;
