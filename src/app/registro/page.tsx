import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { AuthForm } from "@/components/AuthForm";
import { Notice } from "@/components/ui";
import { authConfigured, getUser, safeNext } from "@/lib/auth";
import { I18nText } from "@/components/I18nProvider";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const configured = authConfigured();
  const next = safeNext(searchParams.next);
  const user = configured ? await getUser() : null;
  if (user) redirect(next);
  return (
    <AuthShell>
        {!configured ? (
          <Notice tone="warn"><I18nText text="La autenticación aún no está configurada. Añade NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (ver README)." /></Notice>
        ) : (
          <AuthForm mode="register" initialNext={next} initialError={searchParams.error === "callback" ? "El enlace no es válido o ha caducado. Inténtalo de nuevo." : undefined} />
        )}
      </AuthShell>
  );
}
