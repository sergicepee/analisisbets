import Link from "next/link";
import { Header } from "@/components/Header";
import { Notice } from "@/components/ui";
import { Shield } from "@/components/Shield";
import { getLeagueSeasons, getLeagueTeams, getLeagues } from "@/lib/apifootball";
import { getTeamLogoFallbackUrl } from "@/lib/apifootball";
import { csvLeagueById } from "@/lib/csvLeagues";
import { getLeagueLogoUrl } from "@/lib/leagueLogo";

export const dynamic = "force-dynamic";

export default async function LeaguePage({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string | undefined> }) {
  const id = Number(params.id);
  const [leagues, seasons] = await Promise.all([getLeagues(), getLeagueSeasons(id)]);
  const league = leagues.find((item) => item.id === id) ?? csvLeagueById(id);
  const leagueLogo = league && "logo" in league ? league.logo : null;
  const selected = Number(searchParams.season) || seasons[0];
  const teams = await getLeagueTeams(id, selected);
  return <><Header back="/leagues" /><main className="space-y-4 px-4 pb-8 pt-5 lg:mx-auto lg:max-w-3xl">
    <div className="flex items-center gap-3"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-white p-1"><Shield src={getLeagueLogoUrl(id, leagueLogo)} fallbackSrc={league?.flag} alt="" size={46}/></span><div><h1 className="text-2xl font-black">{league?.name ?? "Liga"}</h1><p className="text-sm text-muted">{league?.country}</p></div></div>
    {teams.length ? <section className="space-y-2"><h2 className="font-bold">Equipos · {teams.length}</h2><div className="grid gap-2 sm:grid-cols-2">{teams.map((team) => <Link key={team.id} href={`/equipo/${team.id}?league=${id}&season=${selected}&name=${encodeURIComponent(team.name)}`} className="card flex items-center gap-3 px-3 py-2.5"><Shield src={team.logo ?? null} fallbackSrc={getTeamLogoFallbackUrl(team.name, league?.country ?? "")} alt={team.name} size={34}/><span className="min-w-0 flex-1 truncate text-sm font-semibold">{team.name}</span><span className="text-muted">›</span></Link>)}</div></section> : <Notice>No hay equipos históricos disponibles para esta liga.</Notice>}
  </main></>;
}
