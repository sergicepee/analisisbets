create table if not exists public.user_bets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  event_date  date not null,
  league_name text check (league_name is null or char_length(league_name) between 1 and 100),
  home_team   text check (home_team is null or char_length(home_team) between 1 and 100),
  away_team   text check (away_team is null or char_length(away_team) between 1 and 100),
  market      text not null check (char_length(market) between 1 and 80),
  selection   text not null check (char_length(selection) between 1 and 120),
  odds        numeric(13,3) not null constraint user_bets_odds_check check (odds > 1 and odds <= 1000000000),
  stake       numeric(12,2) not null check (stake > 0 and stake <= 1000000),
  bet_type    text not null default 'single' check (bet_type in ('single', 'accumulator')),
  legs        jsonb not null default '[]'::jsonb check (jsonb_typeof(legs) = 'array'),
  status      text not null default 'pending' check (status in ('pending', 'won', 'lost', 'void')),
  created_at  timestamptz not null default now(),
  constraint user_bets_ticket_shape_check check (
    (bet_type = 'single' and home_team is not null and away_team is not null and legs = '[]'::jsonb)
    or (bet_type = 'accumulator' and home_team is null and away_team is null)
  )
);

create index if not exists user_bets_user_event_idx
  on public.user_bets (user_id, event_date desc, created_at desc);

alter table public.user_bets enable row level security;

drop policy if exists "user_bets_select_own" on public.user_bets;
drop policy if exists "user_bets_insert_own" on public.user_bets;
drop policy if exists "user_bets_update_own" on public.user_bets;
drop policy if exists "user_bets_delete_own" on public.user_bets;

create policy "user_bets_select_own"
  on public.user_bets for select to authenticated
  using (auth.uid() = user_id);
create policy "user_bets_insert_own"
  on public.user_bets for insert to authenticated
  with check (auth.uid() = user_id);
create policy "user_bets_update_own"
  on public.user_bets for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_bets_delete_own"
  on public.user_bets for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.user_bets from anon;
grant select, insert, update, delete on public.user_bets to authenticated;
