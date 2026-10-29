import { InfoPage, Contact } from "@/components/InfoPage";
import { t } from "@/lib/i18n";
import { BRAND } from "@/lib/config";

export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <InfoPage title={t("Colaboración")}>
      <p>¿Quieres colaborar con {BRAND.name}: datos, contenido, comunidad o integración? Escríbenos y cuéntanos tu propuesta.</p>
      <Contact subject={`${BRAND.name} · Colaboración`} />
    </InfoPage>
  );
}
