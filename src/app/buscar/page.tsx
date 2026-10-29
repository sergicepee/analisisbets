import Link from "next/link";
import { Header } from "@/components/Header";
import { Flag, Shield } from "@/components/Shield";
import { Notice } from "@/components/ui";
import { getLeagues, searchTeams, type TeamHit } from "@/lib/apifootball";
import { countryEs, errMsg } from "@/lib/format";
import type { LeagueInfo } from "@/lib/types";
import { IconGo, IconSearch } from "@/components/icons";

export const dynamic = "force-dynamic";
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default async function Page({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const q = (searchParams.q ?? "").trim();
  let leagues: LeagueInfo[] = [], teams: TeamHit[] = [];
  const errors: string[] = [];
  try { leagues = await getLeagues(); } catch (e) { errors.push(errMsg(e)); }
  if (q.length >= 2) {
    const n = norm(q);
    leagues = leagues.filter((l) => norm(l.name).includes(n) || norm(countryEs(l.country, l.flag)).includes(n)).slice(0, 20);
    try { teams = await searchTeams(q); } catch (e) { errors.push(errMsg(e)); }
  }
  return (
    <>
      <Header back="/" />
      <main className="space-y-4 px-4 pt-5 lg:mx-auto lg:max-w-3xl">
        <h1 className="text-3xl font-black">Buscar</h1>
        <form className="relative">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} autoFocus placeholder="Buscar equipos, ligas..." className="w-full rounded-xl border border-line bg-card py-3 pl-9 pr-3 text-sm outline-none placeholder:text-muted focus:border-brand" />
        </form>
        {q.length > 0 && q.length < 3 && <Notice>Escribe al menos 3 letras para buscar equipos.</Notice>}
        {errors.length > 0 && <Notice tone="warn">{errors[0]}</Notice>}
        {leagues.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-bold">Ligas</h2>
            {leagues.map((l) => (
              <Link key={l.id} href={`/liga/${l.id}`} className="card flex items-center gap-3 px-3 py-2.5">
                <Shield src={l.logo} alt="" size={28} />
                <div className="flex-1"><div className="text-sm font-bold">{l.name}</div><div className="flex items-center gap-1.5 text-xs text-muted"><Flag src={l.flag} />{countryEs(l.country, l.flag)}</div></div>
                <IconGo className="h-4 w-4 text-muted" />
              </Link>
            ))}
          </section>
        )}
        {teams.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-bold">Equipos</h2>
            {teams.map((t) => (
              <Link key={t.id} href={`/equipo/${t.id}?name=${encodeURIComponent(t.name)}${t.leagueId ? `&league=${t.leagueId}` : ""}`} className="card flex items-center gap-3 px-3 py-2.5">
                <Shield src={t.logo} fallbackSrc={t.logoFallback} alt={t.name} size={28} />
                <div className="flex-1"><div className="text-sm font-bold">{t.name}</div><div className="text-xs text-muted">{t.country}</div></div>
                <IconGo className="h-4 w-4 text-muted" />
              </Link>
            ))}
          </section>
        )}
        {q.length >= 3 && !errors.length && !leagues.length && !teams.length && <Notice>Sin resultados para “{q}”.</Notice>}
      </main>
    </>
  );
}
