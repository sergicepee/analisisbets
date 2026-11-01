import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { BetTracker } from "@/components/BetTracker";
import { I18nText } from "@/components/I18nProvider";
import { Notice } from "@/components/ui";
import { authConfigured, getUser } from "@/lib/auth";
import { getUserTrackedBets } from "@/lib/bet-tracker";
import { getFixture, getFixturesByDate } from "@/lib/apifootball";
import { isDate, todayStr } from "@/lib/format";
import { getTz } from "@/lib/prefs";
import type { Fixture } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MyBetsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const today = todayStr();
  const fixtureIdValue = Number(searchParams.fixtureId);
  const requestedFixtureId = /^\d{1,16}$/.test(searchParams.fixtureId ?? "")
    && Number.isSafeInteger(fixtureIdValue)
    && fixtureIdValue >= 0
    ? fixtureIdValue
    : null;
  const leagueIdValue = Number(searchParams.leagueId);
  const requestedLeagueId = /^\d+$/.test(searchParams.leagueId ?? "")
    && Number.isSafeInteger(leagueIdValue)
    ? leagueIdValue
    : undefined;
  const requestedDate = searchParams.date && isDate(searchParams.date) ? searchParams.date : today;
  const query = new URLSearchParams();
  if (requestedFixtureId !== null) query.set("fixtureId", String(requestedFixtureId));
  if (requestedLeagueId !== undefined) query.set("leagueId", String(requestedLeagueId));
  if (requestedFixtureId !== null) query.set("date", requestedDate);
  const nextPath = query.toString() ? `/mis-apuestas?${query.toString()}` : "/mis-apuestas";

  if (!authConfigured()) {
    return (
      <>
        <Header />
        <main className="space-y-4 px-4 pb-8 pt-5 lg:mx-auto lg:max-w-4xl lg:px-8">
          <h1 className="text-2xl font-black"><I18nText text="Mis apuestas" /></h1>
          <Notice tone="warn"><I18nText text="Configura Supabase Auth para guardar tu registro de apuestas." /></Notice>
        </main>
      </>
    );
  }

  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);

  const [betsResult, fixturesResult, selectedFixtureResult] = await Promise.allSettled([
    getUserTrackedBets(user.id),
    getFixturesByDate(requestedDate, requestedDate === today),
    requestedFixtureId
      ? getFixture(requestedFixtureId, requestedLeagueId, requestedDate)
      : Promise.resolve(null),
  ]);
  if (betsResult.status === "rejected") console.error("Could not load user bet records:", betsResult.reason);
  if (fixturesResult.status === "rejected") console.error("Could not load today's fixtures for the bet tracker:", fixturesResult.reason);
  if (selectedFixtureResult.status === "rejected") console.error("Could not load the selected fixture for the bet tracker:", selectedFixtureResult.reason);

  const bets = betsResult.status === "fulfilled" ? betsResult.value.bets : [];
  const error = betsResult.status === "rejected" || (betsResult.status === "fulfilled" && betsResult.value.error);
  const fixtures: Fixture[] = fixturesResult.status === "fulfilled" ? fixturesResult.value : [];
  const initialFixture = selectedFixtureResult.status === "fulfilled" ? selectedFixtureResult.value : null;
  const fixtureLoadError = fixturesResult.status === "rejected";
  const selectedFixtureError = requestedFixtureId !== null && (
    selectedFixtureResult.status === "rejected"
    || (selectedFixtureResult.status === "fulfilled" && selectedFixtureResult.value === null)
  );
  return (
    <>
      <Header />
      <main className="space-y-5 px-4 pb-8 pt-5 lg:mx-auto lg:max-w-5xl lg:px-8">
        <header>
          <h1 className="text-2xl font-black"><I18nText text="Mis apuestas" /></h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            <I18nText text="Registra tus apuestas y consulta tus resultados. Tus datos son privados." />
          </p>
        </header>
        {error && (
          <Notice tone="warn">
            <I18nText text="No se pudo cargar tu registro. Comprueba que la migración de Mi registro esté aplicada en Supabase." />
          </Notice>
        )}
        <BetTracker
          initialBets={bets}
          fixturesForDate={fixtures}
          fixturesDate={requestedDate}
          initialFixture={initialFixture}
          fixtureLoadError={fixtureLoadError}
          selectedFixtureError={selectedFixtureError}
          timeZone={getTz()}
        />
        <p className="text-xs text-muted">
          <I18nText text="El registro es solo para seguimiento personal; no es una recomendación de apuesta." />{" "}
          <Link href="/ayuda" className="underline underline-offset-2"><I18nText text="Ayuda" /></Link>
        </p>
      </main>
    </>
  );
}
