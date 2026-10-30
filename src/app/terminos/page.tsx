import { InfoPage, Contact } from "@/components/InfoPage";
import { I18nText } from "@/components/I18nProvider";
import { BRAND } from "@/lib/config";

export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <InfoPage title={<I18nText text="Términos" />}>
      <p className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn"><I18nText text="Texto provisional. Antes de publicar la web al público, hazlo revisar por un profesional." /></p>
      <p><I18nText text={`${BRAND.name} ofrece información estadística de fútbol con fines informativos. Las probabilidades son estimaciones y no garantizan ningún resultado. No es asesoramiento de apuestas ni financiero.`} /></p>
      <p><I18nText text="Las apuestas pueden causar adicción y pérdidas económicas. Juega con responsabilidad y solo si eres mayor de edad en tu país." /></p>
      <Contact subject={`${BRAND.name} · Términos`} />
    </InfoPage>
  );
}
