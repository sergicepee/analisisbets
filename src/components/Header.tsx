import { Brand } from "./Logo";
import { DesktopNav } from "./DesktopNav";
import { UserMenu } from "./UserMenu";
import { BackButton } from "./BackButton";
import { SearchLauncher } from "./SearchModal";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { createAuthServer, getUser } from "@/lib/auth";
import { getTz } from "@/lib/prefs";

export async function Header({ back }: { back?: string }) {
  const user = await getUser();
  let profile: { display_name: string | null; avatar_url: string | null } | null = null;
  if (user) {
    const auth = createAuthServer();
    const result = await auth.from("profiles").select("display_name,avatar_url").eq("id", user.id).maybeSingle();
    if (!result.error) profile = result.data;
    else {
      const fallback = await auth.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
      profile = fallback.data ? { ...fallback.data, avatar_url: null } : null;
    }
  }
  return (
    <header className="sticky top-0 z-[80] flex items-center justify-between border-b border-line bg-bg/90 px-4 py-3 backdrop-blur lg:grid lg:grid-cols-[1fr_auto_1fr] lg:px-8">
      <div className="flex items-center gap-3">
        {back && (
          <span className="text-slate-200 lg:hidden"><BackButton fallback={back} /></span>
        )}
        <Brand />
      </div>
      <DesktopNav />
      <div className="flex items-center justify-end gap-3 text-slate-300">
        <ThemeSwitcher />
        <SearchLauncher className="rounded-lg p-2 text-muted transition hover:bg-card2 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" />
        <UserMenu loggedIn={!!user} displayName={profile?.display_name || user?.email || undefined} avatarUrl={profile?.avatar_url || undefined} tz={getTz()} telegramUrl={process.env.NEXT_PUBLIC_TELEGRAM_URL || undefined} />
      </div>
    </header>
  );
}
