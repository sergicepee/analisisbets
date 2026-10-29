import { InfoPage, Contact } from "@/components/InfoPage";
import { t } from "@/lib/i18n";
import { BRAND } from "@/lib/config";

export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <InfoPage title={t("Ayuda y soporte")}>
      <h2 className="font-bold text-white">¿Qué son las probabilidades?</h2>
      <p>Son estimaciones estadísticas calculadas con los últimos partidos de cada equipo y las predicciones de API‑Football. No son garantías ni consejos de apuesta.</p>
      <h2 className="font-bold text-white">¿Por qué veo “—” en algunos datos?</h2>
      <p>Cuando faltan estadísticas (la liga no tiene cobertura, el plan de la API no las incluye o hay pocos partidos) {BRAND.name} prefiere no mostrar nada antes que inventar una cifra.</p>
      <h2 className="font-bold text-white">¿Qué significan los colores?</h2>
      <p>Verde: por encima de la media de la liga (±10%). Ámbar: similar. Rojo: por debajo. Si no hay media de liga disponible, el color indica solo si el porcentaje es alto, medio o bajo.</p>
      <h2 className="font-bold text-white">Contacto</h2>
      <Contact subject={`${BRAND.name} · Soporte`} />
    </InfoPage>
  );
}
