-- GolLab · esquema de Supabase. Ejecuta esto en SQL Editor > New query.

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
  updated_at    timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

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