import { InfoPage, Contact } from "@/components/InfoPage";
import { t } from "@/lib/i18n";
import { BRAND } from "@/lib/config";

export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <InfoPage title={t("Términos")}>
      <p className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">Texto provisional. Antes de publicar la web al público, hazlo revisar por un profesional.</p>
      <p>{BRAND.name} ofrece información estadística de fútbol con fines informativos. Las probabilidades son estimaciones y no garantizan ningún resultado. No es asesoramiento de apuestas ni financiero.</p>
      <p>Las apuestas pueden causar adicción y pérdidas económicas. Juega con responsabilidad y solo si eres mayor de edad en tu país.</p>
      <Contact subject={`${BRAND.name} · Términos`} />
    </InfoPage>
  );
}
