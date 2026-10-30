import { Header } from "@/components/Header";
import { Notice } from "@/components/ui";
import { LeagueCatalog } from "@/components/LeagueCatalog";
import { getLeagues } from "@/lib/apifootball";
import { countryEs, errMsg, leagueType } from "@/lib/format";
import type { LeagueInfo } from "@/lib/types";
import { I18nText } from "@/components/I18nProvider";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  let leagues: LeagueInfo[] = [];
  let error: string | null = null;
  try { leagues = await getLeagues(); } catch (e) { error = errMsg(e); }
  const by = new Map<string, { country: string; flag: string | null; items: { id: number; name: string; type: string; logo: string | null }[] }>();
  for (const l of leagues) {
    const c = countryEs(l.country, l.flag);
    const g = by.get(c) ?? { country: c, flag: l.flag, items: [] };
    g.items.push({ id: l.id, name: l.name, type: leagueType(l.type), logo: l.logo });
    by.set(c, g);
  }
  const first = ["España", "Italia", "Alemania", "Francia", "Inglaterra", "Portugal", "Países Bajos"];
  const order = (c: string) => { const i = first.indexOf(c); return i === -1 ? 999 : i; };
  const sorted = [...by.values()]
    .map((g) => ({ ...g, items: g.items.sort((a, b) => (a.type === b.type ? 0 : a.type === "Liga" ? -1 : 1)) }))
    .sort((a, b) => order(a.country) - order(b.country) || a.country.localeCompare(b.country, "es"));
  const intl = sorted.find((g) => g.country === "Europa")?.items ?? [];
  const groups = sorted.filter((g) => g.country !== "Europa");
  return (
    <>
      <Header />
      <main className="space-y-4 px-4 pb-8 pt-5 lg:px-8">
        <div>
          <h1 className="text-3xl font-black"><I18nText text="Ligas" /></h1>
          <p className="mt-1 text-sm text-muted"><I18nText text="Explora competiciones y encuentra partidos por liga." /></p>
        </div>
        {error && <Notice tone="warn">{error}</Notice>}
        <LeagueCatalog groups={groups} intl={intl} autoFocus={searchParams.buscar === "1"} />
      </main>
    </>
  );
}
