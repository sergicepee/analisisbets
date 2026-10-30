import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { AuthForm } from "@/components/AuthForm";
import { Notice } from "@/components/ui";
import { authConfigured, getUser } from "@/lib/auth";
import { I18nText } from "@/components/I18nProvider";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const configured = authConfigured();
  const user = configured ? await getUser() : null;
  if (configured && !user) redirect("/recuperar?error=callback");
  return (
    <AuthShell>
        {!configured ? (
          <Notice tone="warn"><I18nText text="La autenticación aún no está configurada. Añade NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (ver README)." /></Notice>
        ) : (
          <AuthForm mode="reset" initialError={searchParams.error === "callback" ? "El enlace no es válido o ha caducado. Inténtalo de nuevo." : undefined} />
        )}
      </AuthShell>
  );
}
