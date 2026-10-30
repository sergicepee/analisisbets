import { redirect } from "next/navigation";
import { Header } from "@/components/Header";
import { I18nText } from "@/components/I18nProvider";
import { Notice } from "@/components/ui";
import { ProfileCard } from "@/components/ProfileSettingsModal";
import { authConfigured, createAuthServer, getUser } from "@/lib/auth";
import { getTz } from "@/lib/prefs";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!authConfigured()) {
    return <><Header back="/" /><main className="px-4 pt-6"><Notice tone="warn"><I18nText text="La autenticación aún no está configurada (ver README)." /></Notice></main></>;
  }
  const user = await getUser();
  if (!user) redirect("/login");
  const auth = createAuthServer();
  const result = await auth.from("profiles").select("display_name,avatar_url").eq("id", user.id).maybeSingle();
  let profile: { display_name: string | null; avatar_url: string | null } | null = result.data
    ? { display_name: result.data.display_name, avatar_url: result.data.avatar_url }
    : null;
  if (result.error) {
    const fallback = await auth.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
    profile = fallback.data ? { display_name: fallback.data.display_name, avatar_url: null } : null;
  }
  const provider = (user.app_metadata?.provider as string | undefined) ?? "email";
  const displayName = profile?.display_name || user.email?.split("@")[0] || "Usuario";

  return <>
    <Header back="/" />
    <main className="px-4 pt-6 lg:mx-auto lg:max-w-5xl lg:pt-8">
      <ProfileCard userId={user.id} email={user.email || ""} displayName={displayName} avatarUrl={profile?.avatar_url || null} provider={provider} createdAt={user.created_at} tz={getTz()} />
    </main>
  </>;
}
