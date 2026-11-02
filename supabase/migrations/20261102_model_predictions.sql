create table if not exists public.model_predictions (
  id uuid primary key default gen_random_uuid(),
  fixture_id bigint not null,
  fixture_date timestamptz not null,
  league_id integer not null,
  league_name text not null,
  home_team_id bigint not null,
  home_team_name text not null,
  away_team_id bigint not null,
  away_team_name text not null,
  predicted_at timestamptz not null default now(),
  model_version text not null,
  data_version text not null,
  data_snapshot_version integer not null,
  data_snapshot jsonb not null check (jsonb_typeof(data_snapshot) = 'object'),
  prediction jsonb not null check (jsonb_typeof(prediction) = 'object'),
  actual_result jsonb check (actual_result is null or jsonb_typeof(actual_result) = 'object'),
  log_loss double precision,
  brier_score double precision,
  market_metrics jsonb,
  evaluated_at timestamptz,
  constraint model_predictions_fixture_model_key unique (fixture_id, model_version)
);

create index if not exists model_predictions_fixture_date_idx
  on public.model_predictions (fixture_date);
create index if not exists model_predictions_pending_idx
  on public.model_predictions (fixture_date)
  where actual_result is null;

alter table public.model_predictions enable row level security;
revoke all on public.model_predictions from anon, authenticated;
grant all on public.model_predictions to service_role;
