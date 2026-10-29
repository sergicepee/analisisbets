import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { AuthForm } from "@/components/AuthForm";
import { Notice } from "@/components/ui";
import { authConfigured, getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const configured = authConfigured();
  const user = configured ? await getUser() : null;
  if (user) redirect("/cuenta");
  return (
    <>
      <Header back="/" />
      <main className="space-y-4 px-4 pt-6 lg:mx-auto lg:max-w-md">
        {!configured ? (
          <Notice tone="warn">La autenticación aún no está configurada. Añade NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY (ver README).</Notice>
        ) : (
          <AuthForm mode="login" initialError={searchParams.error === "callback" ? "El enlace no es válido o ha caducado. Inténtalo de nuevo." : undefined} />
        )}
      </main>
    </>
  );
}
