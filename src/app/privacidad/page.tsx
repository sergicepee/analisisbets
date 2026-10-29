import { InfoPage, Contact } from "@/components/InfoPage";
import { t } from "@/lib/i18n";
import { BRAND } from "@/lib/config";

export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <InfoPage title={t("Privacidad")}>
      <p className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">Texto provisional. Antes de publicar la web al público, hazlo revisar por un profesional (RGPD y legislación aplicable).</p>
      <p>{BRAND.name} guarda el email y el nombre que facilitas al crear una cuenta, y tus preferencias de idioma, tema y zona horaria (en cookies de tu navegador). El acceso con Google se gestiona a través de Supabase y Google.</p>
      <p>No vendemos tus datos. Puedes solicitar la eliminación de tu cuenta escribiendo al contacto indicado.</p>
      <Contact subject={`${BRAND.name} · Privacidad`} />
    </InfoPage>
  );
}
