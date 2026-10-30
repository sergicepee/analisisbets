import Link from "next/link";
import { DateNav } from "./DateNav";
import { MatchRow } from "./MatchRow";
import { AutoRefresh } from "./AutoRefresh";
import { PremiumBanner } from "./PremiumBanner";
import { Shield } from "./Shield";
import { Notice } from "./ui";
import { IconBall, IconCalendar, IconInfo, IconMatches, IconTrophy } from "./icons";
import { getFixturesByDate } from "@/lib/apifootball";
import { apiEnabled, LEAGUE_IDS, PRIORITY_LEAGUES, SHOW_PREMIUM } from "@/lib/config";
import { countryEs, errMsg, statusGroup, todayStr } from "@/lib/format";
import type { Fixture, StatusGroup } from "@/lib/types";
import { t } from "@/lib/i18n";

const FILTERS: [string, string][] = [
  ["all", "Todos"], ...(apiEnabled ? [["live", "En vivo"] as [string, string]] : []), ["finished", "Finalizados"],
  ["upcoming", "Próximos"], ["pending", "Pendientes de actualizar"],
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
      {apiEnabled && counts.live > 0 && date === today && <AutoRefresh seconds={60} />}
      <div className="card rounded-xl p-2.5 sm:p-3">
        <DateNav date={date} base="/" extra={`${leagueId ? `&league=${leagueId}` : ""}${filter !== "all" ? `&f=${filter}` : ""}`} />
      </div>
      <nav aria-label="Filtrar partidos" className="flex min-w-0 gap-1 overflow-x-auto border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map(([key, label]) => {
          const on = filter === key;
          const live = key === "live" && counts.live > 0;
          const Icon = key === "all" ? IconMatches : key === "live" ? IconBall : key === "finished" ? IconTrophy : key === "upcoming" ? IconCalendar : IconInfo;
          return <Link key={key} href={href(key)} aria-current={on ? "page" : undefined} className={`relative flex shrink-0 items-center gap-1.5 px-2.5 py-2.5 text-xs font-semibold transition-colors sm:px-3 sm:text-sm ${on ? "text-brand" : live ? "text-chartHit" : "text-muted hover:text-white"}`}>
            <Icon className="h-3.5 w-3.5" />{t(label)}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${on ? "bg-brand/15 text-brand" : "bg-card2 text-muted"}`}>{counts[key]}</span>
            {on && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand" />}
          </Link>;
        })}
      </nav>
      {leagueId && (
        <Link href={`/?date=${date}`} className="chip border-brand/50 text-brand">{t("Liga:")} {fixtures[0]?.leagueName ?? leagueId} ✕</Link>
      )}
      {error && <Notice tone="warn">{t("No se pudo cargar el listado:")} {error}</Notice>}
      {!error && ordered.length === 0 && <Notice>{t("No hay partidos para este filtro y fecha.")}</Notice>}
      {ordered.map((g, i) => (
        <div key={g[0].leagueId} className="space-y-3">
          <section className="overflow-hidden rounded-2xl border border-line bg-card">
            <div className="flex min-h-11 items-center gap-2.5 bg-card2 px-3 py-2.5 sm:px-4">
              <Shield src={g[0].leagueLogo} fallbackSrc={g[0].flag} alt="" size={23} />
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted">{countryEs(g[0].country, g[0].flag)}</span>
              <span className="min-w-0 truncate text-xs font-extrabold sm:text-sm">{g[0].leagueName}</span>
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
