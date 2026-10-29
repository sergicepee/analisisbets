import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { AuthForm } from "@/components/AuthForm";
import { Notice } from "@/components/ui";
import { authConfigured, getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const configured = authConfigured();
  const user = configured ? await getUser() : null;
  
  return (
    <AuthShell>
        {!configured ? (
          <Notice tone="warn">La autenticación aún no está configurada. Añade NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (ver README).</Notice>
        ) : (
          <AuthForm mode="recover" initialError={searchParams.error === "callback" ? "El enlace no es válido o ha caducado. Inténtalo de nuevo." : undefined} />
        )}
      </AuthShell>
  );
}
