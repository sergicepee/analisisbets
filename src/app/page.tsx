import { Header } from "@/components/Header";
import { MatchList } from "@/components/MatchList";
import { Workspace } from "@/components/Workspace";
import { isDate, todayStr } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default function Page({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const date = isDate(searchParams.date) ? (searchParams.date as string) : todayStr();
  return (
    <>
      <Header />
      <Workspace list={<MatchList date={date} filter={searchParams.f ?? "all"} leagueId={searchParams.league ? Number(searchParams.league) : null} />}>
        <div className="hidden h-full min-h-[50vh] items-center justify-center rounded-2xl border border-dashed border-line text-sm text-muted lg:flex">
          Selecciona un partido para ver su análisis
        </div>
      </Workspace>
    </>
  );
}
