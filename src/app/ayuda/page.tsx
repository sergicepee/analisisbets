import { InfoPage, Contact } from "@/components/InfoPage";
import { I18nText } from "@/components/I18nProvider";
import { BRAND } from "@/lib/config";

export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <InfoPage title={<I18nText text="Ayuda y soporte" />}>
      <h2 className="font-bold text-fg"><I18nText text="¿Qué son las probabilidades?" /></h2>
      <p><I18nText text="Son estimaciones estadísticas calculadas con los últimos partidos de cada equipo. No son garantías ni consejos de apuesta." /></p>
      <h2 className="font-bold text-fg"><I18nText text="¿Por qué veo “—” en algunos datos?" /></h2>
      <p><I18nText text={`Cuando ESPN y los CSV no tienen estadísticas disponibles o hay pocos partidos, ${BRAND.name} prefiere no mostrar nada antes que inventar una cifra.`} /></p>
      <h2 className="font-bold text-fg"><I18nText text="¿Qué significan los colores?" /></h2>
      <p><I18nText text="Verde: por encima de la media de la liga (más del 10%). Ámbar: similar (±10%). Rojo: por debajo (más del 10%). Sin media de liga, en las probabilidades el color indica si son altas (65% o más), intermedias o bajas (35% o menos)." /></p>
      <h2 className="font-bold text-fg"><I18nText text="Contacto" /></h2>
      <Contact subject={`${BRAND.name} · Soporte`} />
    </InfoPage>
  );
}
