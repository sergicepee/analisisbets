-- PICKZONE · esquema de Supabase. Ejecuta esto en SQL Editor > New query.

-- Caché genérica de respuestas de la API (con caducidad)
create table if not exists public.api_cache (
  key         text primary key,
  data        jsonb not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists api_cache_expires_idx on public.api_cache (expires_at);

-- Estadísticas reales de partidos terminados (no cambian: se guardan para siempre).
-- Sirven también para calcular la media de liga con datos propios.
create table if not exists public.fixture_stats (
  fixture_id  bigint primary key,
  league_id   int    not null,
  season      int    not null,
  home_id     int    not null,
  away_id     int    not null,
  home        jsonb  not null,
  away        jsonb  not null,
  goals_home  int    not null,
  goals_away  int    not null,
  has_data    boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists fixture_stats_league_idx on public.fixture_stats (league_id, season);

-- Seguridad: RLS activado y sin políticas => solo el servidor (service role) puede leer/escribir.
alter table public.api_cache     enable row level security;
alter table public.fixture_stats enable row level security;

-- ───────────────── Cuentas de usuario ─────────────────
-- Perfil público mínimo de cada usuario (1:1 con auth.users).
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  avatar_url    text,
  updated_at    timestamptz not null default now()
);
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Estado de suscripción. Solo el servidor (service role/proveedor de pagos) puede modificarlo.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null check (provider in ('manual', 'stripe', 'paypal')),
  provider_customer_id text unique,
  provider_subscription_id text unique,
  status text not null default 'inactive' check (status in ('inactive', 'active', 'trialing', 'past_due', 'canceled', 'expired')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions for select to authenticated using (auth.uid() = user_id);
revoke insert, update, delete on public.subscriptions from anon, authenticated;

-- Partidos favoritos. El usuario solo puede consultar, añadir y quitar sus propias filas.
create table if not exists public.favorite_fixtures (
  user_id    uuid not null references auth.users(id) on delete cascade,
  fixture_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, fixture_id)
);
alter table public.favorite_fixtures enable row level security;
drop policy if exists "favorite_fixtures_select_own" on public.favorite_fixtures;
drop policy if exists "favorite_fixtures_insert_own" on public.favorite_fixtures;
drop policy if exists "favorite_fixtures_delete_own" on public.favorite_fixtures;
create policy "favorite_fixtures_select_own" on public.favorite_fixtures for select to authenticated using (auth.uid() = user_id);
create policy "favorite_fixtures_insert_own" on public.favorite_fixtures for insert to authenticated with check (auth.uid() = user_id);
create policy "favorite_fixtures_delete_own" on public.favorite_fixtures for delete to authenticated using (auth.uid() = user_id);
revoke all on public.favorite_fixtures from anon;
grant select, insert, delete on public.favorite_fixtures to authenticated;

-- Equipos seguidos. Separados de los partidos favoritos y sincronizados por cuenta.
create table if not exists public.followed_teams (
  user_id    uuid not null references auth.users(id) on delete cascade,
  team_id    bigint not null,
  team_name  text not null check (char_length(team_name) between 1 and 100),
  created_at timestamptz not null default now(),
  primary key (user_id, team_id)
);
alter table public.followed_teams enable row level security;
drop policy if exists "followed_teams_select_own" on public.followed_teams;
drop policy if exists "followed_teams_insert_own" on public.followed_teams;
drop policy if exists "followed_teams_update_own" on public.followed_teams;
drop policy if exists "followed_teams_delete_own" on public.followed_teams;
create policy "followed_teams_select_own" on public.followed_teams for select to authenticated using (auth.uid() = user_id);
create policy "followed_teams_insert_own" on public.followed_teams for insert to authenticated with check (auth.uid() = user_id);
create policy "followed_teams_update_own" on public.followed_teams for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "followed_teams_delete_own" on public.followed_teams for delete to authenticated using (auth.uid() = user_id);
revoke all on public.followed_teams from anon;
grant select, insert, update, delete on public.followed_teams to authenticated;

-- Ligas seguidas. Se sincronizan por cuenta y aparecen en Favoritos.
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
create policy "followed_leagues_select_own" on public.followed_leagues for select to authenticated using (auth.uid() = user_id);
create policy "followed_leagues_insert_own" on public.followed_leagues for insert to authenticated with check (auth.uid() = user_id);
create policy "followed_leagues_update_own" on public.followed_leagues for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "followed_leagues_delete_own" on public.followed_leagues for delete to authenticated using (auth.uid() = user_id);
revoke all on public.followed_leagues from anon;
grant select, insert, update, delete on public.followed_leagues to authenticated;

-- Registro privado de apuestas. Las cuotas y selecciones las introduce cada usuario.
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
create index if not exists user_bets_user_event_idx on public.user_bets (user_id, event_date desc, created_at desc);
alter table public.user_bets enable row level security;
drop policy if exists "user_bets_select_own" on public.user_bets;
drop policy if exists "user_bets_insert_own" on public.user_bets;
drop policy if exists "user_bets_update_own" on public.user_bets;
drop policy if exists "user_bets_delete_own" on public.user_bets;
create policy "user_bets_select_own" on public.user_bets for select to authenticated using (auth.uid() = user_id);
create policy "user_bets_insert_own" on public.user_bets for insert to authenticated with check (auth.uid() = user_id);
create policy "user_bets_update_own" on public.user_bets for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_bets_delete_own" on public.user_bets for delete to authenticated using (auth.uid() = user_id);
revoke all on public.user_bets from anon;
grant select, insert, update, delete on public.user_bets to authenticated;

-- Fotos de perfil públicas; cada usuario solo puede escribir en su propia carpeta.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png'];

drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_select_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Crea el perfil automáticamente al registrarse (email o Google).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
