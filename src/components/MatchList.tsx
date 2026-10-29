import Link from "next/link";
import { DateNav } from "./DateNav";
import { MatchRow } from "./MatchRow";
import { AutoRefresh } from "./AutoRefresh";
import { PremiumBanner } from "./PremiumBanner";
import { Flag } from "./Shield";
import { Notice } from "./ui";
import { getFixturesByDate } from "@/lib/apifootball";
import { LEAGUE_IDS, PRIORITY_LEAGUES, SHOW_PREMIUM } from "@/lib/config";
import { countryEs, errMsg, statusGroup, todayStr } from "@/lib/format";
import type { Fixture, StatusGroup } from "@/lib/types";

const FILTERS: [string, string][] = [
  ["all", "Todos"], ["live", "En vivo"], ["finished", "Finalizados"],
  ["upcoming", "Próximos"], ["pending", "Pendientes de actualizar"], ["other", "Otros"],
];

export async function MatchList({ date, filter = "all", leagueId = null, selectedId }: { date: string; filter?: string; leagueId?: number | null; selectedId?: number }) {
  const today = todayStr();
  let fixtures: Fixture[] = [];
  let error: string | null = null;
  try { fixtures = await getFixturesByDate(date, date === today); } catch (e) { error = errMsg(e); }
  if (LEAGUE_IDS.length) fixtures = fixtures.filter((f) => LEAGUE_IDS.includes(f.leagueId));
  if (leagueId) fixtures = fixtures.filter((f) => f.leagueId === leagueId);

  const counts: Record<string, number> = { all: fixtures.length, live: 0, finished: 0, upcoming: 0, pending: 0, other: 0 };
  for (const f of fixtures) counts[statusGroup(f) as StatusGroup]++;
  const shown = filter === "all" ? fixtures : fixtures.filter((f) => statusGroup(f) === filter);

  const groups = new Map<number, Fixture[]>();
  for (const f of shown) groups.set(f.leagueId, [...(groups.get(f.leagueId) ?? []), f]);
  const prio = (id: number) => { const i = PRIORITY_LEAGUES.indexOf(id); return i === -1 ? 999 : i; };
  const ordered = [...groups.values()]
    .map((g) => g.sort((a, b) => a.timestamp - b.timestamp))
    .sort((a, b) => prio(a[0].leagueId) - prio(b[0].leagueId) || a[0].country.localeCompare(b[0].country) || a[0].leagueName.localeCompare(b[0].leagueName));

  const href = (key: string) => `/?date=${date}${leagueId ? `&league=${leagueId}` : ""}${key !== "all" ? `&f=${key}` : ""}`;
  const banner = SHOW_PREMIUM ? <PremiumBanner /> : null;

  return (
    <div className="space-y-4 px-4 pb-6 pt-4 lg:px-0">
      {counts.live > 0 && date === today && <AutoRefresh seconds={60} />}
      <DateNav date={date} base="/" extra={`${leagueId ? `&league=${leagueId}` : ""}${filter !== "all" ? `&f=${filter}` : ""}`} />
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([key, label]) => {
          const on = filter === key;
          const live = key === "live" && counts.live > 0;
          const cls = on ? (key === "live" ? "border-loss bg-loss text-white" : "chip-on") : live ? "border-loss/60 text-loss" : "";
          return <Link key={key} href={href(key)} className={`chip ${cls}`}>{label} ({counts[key]})</Link>;
        })}
      </div>
      {leagueId && (
        <Link href={`/?date=${date}`} className="chip border-brand/50 text-brand">Liga: {fixtures[0]?.leagueName ?? leagueId} ✕</Link>
      )}
      {error && <Notice tone="warn">No se pudo cargar el listado: {error}</Notice>}
      {!error && ordered.length === 0 && <Notice>No hay partidos para este filtro y fecha.</Notice>}
      {ordered.map((g, i) => (
        <div key={g[0].leagueId} className="space-y-4">
          <section className="space-y-2">
            <div className="flex items-center gap-2 pt-1 text-sm font-bold text-brand">
              <Flag src={g[0].flag} /> {countryEs(g[0].country, g[0].flag)} · {g[0].leagueName}
            </div>
            {g.map((f) => <MatchRow key={f.id} f={f} date={date} selected={f.id === selectedId} />)}
          </section>
          {i === 0 && banner}
        </div>
      ))}
      {ordered.length === 0 && banner}
    </div>
  );
}
