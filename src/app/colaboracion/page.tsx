import { InfoPage, Contact } from "@/components/InfoPage";
import { I18nText } from "@/components/I18nProvider";
import { BRAND } from "@/lib/config";

export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <InfoPage title={<I18nText text="Colaboración" />}>
      <p><I18nText text={`¿Quieres colaborar con ${BRAND.name}: datos, contenido, comunidad o integración? Escríbenos y cuéntanos tu propuesta.`} /></p>
      <Contact subject={`${BRAND.name} · Colaboración`} />
    </InfoPage>
  );
}
