import { Header } from "@/components/Header";
import { Notice, Panel } from "@/components/ui";
import { getQuota } from "@/lib/apifootball";
import { API_FOOTBALL_ENABLED, API_MIN_INTERVAL_MS, BRAND, FORM_MATCHES, LEAGUE_IDS, MAX_ANALYSIS_FIXTURES, TZ, apiEnabled, hasApiKey } from "@/lib/config";
import { authConfigured } from "@/lib/auth";
import { hasSupabase } from "@/lib/supabase";
import { I18nText } from "@/components/I18nProvider";

export const dynamic = "force-dynamic";

export default async function Page() {
  const quota = apiEnabled ? await getQuota() : null;
  const Row = ({ k, v, ok }: { k: string; v: string; ok?: boolean }) => (
    <div className="flex justify-between border-b border-line py-2 text-sm last:border-0">
      <span className="text-muted"><I18nText text={k} /></span><span className={ok === undefined ? "" : ok ? "font-bold text-win" : "font-bold text-warn"}><I18nText text={v} /></span>
    </div>
  );
  return (
    <>
      <Header back="/" />
      <main className="space-y-4 px-4 pt-5 lg:mx-auto lg:max-w-2xl">
        <h1 className="text-2xl font-black"><I18nText text="Cuenta y estado" /></h1>
        <Notice><I18nText text="Comprobación de la configuración de" /> {BRAND.name}. <I18nText text="Tu cuenta está en" /> <a href="/cuenta" className="text-brand"><I18nText text="Mi cuenta" /></a>.</Notice>
        <Panel title="Conexiones">
          <Row k="API-Football" v={!API_FOOTBALL_ENABLED ? "Desactivada (modo CSV)" : hasApiKey ? "Conectada" : "Activada, falta la clave"} ok={apiEnabled} />
          <Row k="Supabase (caché)" v={hasSupabase() ? "Conectada" : "No configurada (caché en memoria)"} ok={hasSupabase()} />
          <Row k="Autenticación (Supabase Auth)" v={authConfigured() ? "Configurada" : "Falta NEXT_PUBLIC_SUPABASE_*"} ok={authConfigured()} />
          <Row k="Solicitudes diarias restantes" v={quota === null ? "—" : String(quota)} />
        </Panel>
        <Panel title="Parámetros">
          <Row k="Zona horaria" v={TZ} />
          <Row k="Partidos recientes por equipo" v={String(FORM_MATCHES)} />
          <Row k="Máx. partidos analizados" v={String(MAX_ANALYSIS_FIXTURES)} />
          <Row k="Ligas permitidas" v={LEAGUE_IDS.length ? LEAGUE_IDS.join(", ") : "Todas"} />
          <Row k="Pausa entre llamadas" v={`${API_MIN_INTERVAL_MS} ms`} />
        </Panel>
      </main>
    </>
  );
}
