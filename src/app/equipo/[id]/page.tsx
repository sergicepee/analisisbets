import { Header } from "@/components/Header";
import { MatchRow } from "@/components/MatchRow";
import { Notice } from "@/components/ui";
import { Shield } from "@/components/Shield";
import { getLastFixtures, getNextFixtures } from "@/lib/apifootball";
import { errMsg, todayStr } from "@/lib/format";
import type { Fixture } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  let last: Fixture[] = [], next: Fixture[] = [];
  let error: string | null = null;
  try { [last, next] = await Promise.all([getLastFixtures(id), getNextFixtures(id)]); } catch (e) { error = errMsg(e); }
  const all = [...last, ...next];
  const team = all.map((f) => (f.home.id === id ? f.home : f.away.id === id ? f.away : null)).find(Boolean);
  const date = todayStr();
  return (
    <>
      <Header back="/buscar" />
      <main className="space-y-4 px-4 pb-8 pt-5 lg:mx-auto lg:max-w-3xl">
        <div className="flex items-center gap-3">
          <Shield src={team?.logo ?? null} alt="" size={48} />
          <h1 className="text-2xl font-black">{team?.name ?? `Equipo ${id}`}</h1>
        </div>
        {error && <Notice tone="warn">{error}</Notice>}
        {!error && all.length === 0 && <Notice>No hay partidos disponibles para este equipo (o estás en modo demo).</Notice>}
        {next.length > 0 && <section className="space-y-2"><h2 className="font-bold">Próximos partidos</h2>{next.map((f) => <MatchRow key={f.id} f={f} date={date} />)}</section>}
        {last.length > 0 && <section className="space-y-2"><h2 className="font-bold">Últimos resultados</h2>{[...last].reverse().map((f) => <MatchRow key={f.id} f={f} date={date} />)}</section>}
      </main>
    </>
  );
}
