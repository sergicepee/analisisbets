alter table public.user_bets
  alter column home_team drop not null,
  alter column away_team drop not null,
  alter column odds type numeric(13,3);

alter table public.user_bets
  drop constraint if exists user_bets_odds_check,
  drop constraint if exists user_bets_bet_type_check,
  drop constraint if exists user_bets_legs_check,
  drop constraint if exists user_bets_ticket_shape_check;

alter table public.user_bets
  add column if not exists bet_type text not null default 'single',
  add column if not exists legs jsonb not null default '[]'::jsonb;

alter table public.user_bets
  add constraint user_bets_odds_check
    check (odds > 1 and odds <= 1000000000),
  add constraint user_bets_bet_type_check
    check (bet_type in ('single', 'accumulator')),
  add constraint user_bets_legs_check
    check (jsonb_typeof(legs) = 'array'),
  add constraint user_bets_ticket_shape_check check (
    (bet_type = 'single' and home_team is not null and away_team is not null and legs = '[]'::jsonb)
    or (bet_type = 'accumulator' and home_team is null and away_team is null)
  );
