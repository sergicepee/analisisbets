import { Header } from "@/components/Header";
import { MatchRow } from "@/components/MatchRow";
import { Notice } from "@/components/ui";
import { Shield } from "@/components/Shield";
import { getLeagueSeasons, getLeagueTeams, getTeamLogoFallbackUrl, getTeamLogoUrl, getTeamSeasonMatchSeries, getTeamSeasonProfile, getTeamUpcomingFixtures, getTeamProfile } from "@/lib/apifootball";
import { errMsg, todayStr } from "@/lib/format";
import type { Fixture, TeamProfile } from "@/lib/types";
import { TeamStatsChart, type TeamGamePoint } from "@/components/TeamStatsChart";
import Link from "next/link";
import { csvLeagueById } from "@/lib/csvLeagues";

export const dynamic = "force-dynamic";

function safeReturnPath(value: string | undefined) {
  let candidate = value ?? "";
  for (let i = 0; i < 3; i++) {
    if (/^\/match\/\d+(?:\?[^#]*)?$/.test(candidate)) return candidate;
    try {
      const decoded = decodeURIComponent(candidate);
      if (decoded === candidate) break;
      candidate = decoded;
    } catch { break; }
  }
  return "/buscar";
}

export default async function Page({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string | undefined> }) {
  const id = Number(params.id);
  const leagueId = Number(searchParams.league) || undefined;
  const back = safeReturnPath(searchParams.from);
  const seasons = leagueId ? await getLeagueSeasons(leagueId) : [];
  const season = Number(searchParams.season) || seasons[0];
  const teams = leagueId ? await getLeagueTeams(leagueId, season) : [];
  const name = searchParams.name || teams.find((team) => team.id === id)?.name;
  let next: Fixture[] = [];
  let profile: TeamProfile | null = null;
  let chartGames: TeamGamePoint[] = [];
  let error: string | null = null;
  try {
    const [teamProfile, upcoming, series] = await Promise.all([
      name ? (leagueId && season ? getTeamSeasonProfile(id, name, leagueId, season) : getTeamProfile(id, true, season, Infinity, leagueId, name)) : Promise.resolve(null),
      getTeamUpcomingFixtures(id),
      name && leagueId && season ? getTeamSeasonMatchSeries(name, leagueId, season) : Promise.resolve([]),
    ]);
    profile = teamProfile;
    next = upcoming;
    const country = csvLeagueById(leagueId ?? 0)?.country ?? "";
    chartGames = series.map((game) => ({ ...game, opponentLogo: getTeamLogoUrl(game.opponent, country), opponentLogoFallback: getTeamLogoFallbackUrl(game.opponent, country) }));
  } catch (e) { error = errMsg(e); }
  const team = { id, name: name ?? `Equipo ${id}`, logo: getTeamLogoUrl(name ?? "", csvLeagueById(leagueId ?? 0)?.country ?? "") };
  const metrics: [Metric, string][] = [["goals", "Goles"], ["shots", "Tiros"], ["shotsOn", "TAP"], ["corners", "Córners"], ["cards", "Tarjetas"]];
  const date = todayStr();
  return (
    <>
      <Header back={back} />
      <main className="space-y-4 px-4 pb-8 pt-5 lg:mx-auto lg:max-w-3xl">
        <div className="flex items-center gap-3">
          <Shield src={team?.logo ?? null} fallbackSrc={getTeamLogoFallbackUrl(team.name, csvLeagueById(leagueId ?? 0)?.country ?? "")} alt={team.name} size={48} />
          <h1 className="text-2xl font-black">{team.name}</h1>
        </div>
        {leagueId && seasons.length > 0 && <div className="flex flex-wrap gap-2">{seasons.map((s) => <Link key={s} href={`/equipo/${id}?league=${leagueId}&season=${s}&name=${encodeURIComponent(team.name)}`} className={`chip ${s === season ? "chip-on" : ""}`}>{s}/{String(s + 1).slice(-2)}</Link>)}</div>}
        {error && <Notice tone="warn">{error}</Notice>}
        {chartGames.length > 0 && <section className="space-y-2"><h2 className="font-bold">Estadísticas · {season}/{String(season + 1).slice(-2)}</h2><TeamStatsChart games={chartGames} /></section>}
        {profile && chartGames.length === 0 && <Notice>Hay estadísticas resumidas, pero no un historial partido a partido disponible para dibujar la gráfica.</Notice>}
        {next.length > 0 && <section className="space-y-2"><h2 className="font-bold">Próximos partidos</h2>{next.map((f) => <MatchRow key={f.id} f={f} date={date} />)}</section>}
        {!profile && !next.length && !error && <Notice>Sin datos disponibles para este equipo y temporada.</Notice>}
      </main>
    </>
  );
}
