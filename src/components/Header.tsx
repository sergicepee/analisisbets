import Link from "next/link";
import { Brand } from "./Logo";
import { DesktopNav } from "./DesktopNav";
import { UserMenu } from "./UserMenu";
import { IconBack, IconSearch } from "./icons";
import { createAuthServer, getUser } from "@/lib/auth";
import { getTz } from "@/lib/prefs";
import { t } from "@/lib/i18n";

export async function Header({ back }: { back?: string }) {
  const user = await getUser();
  const { data: profile } = user
    ? await createAuthServer().from("profiles").select("display_name").eq("id", user.id).maybeSingle()
    : { data: null };
  return (
    <header className="sticky top-0 z-[80] flex items-center justify-between border-b border-line bg-bg/90 px-4 py-3 backdrop-blur lg:grid lg:grid-cols-[1fr_auto_1fr] lg:px-8">
      <div className="flex items-center gap-3">
        {back && (
          <Link href={back} aria-label="Volver" className="text-slate-200 lg:hidden"><IconBack className="h-5 w-5" /></Link>
        )}
        <Brand />
      </div>
      <DesktopNav />
      <div className="flex items-center justify-end gap-3 text-slate-300">
        <form action="/buscar" className="relative hidden lg:block">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input name="q" placeholder={t("Buscar equipos, ligas...")} className="w-64 rounded-xl border border-line bg-card py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted focus:border-brand" />
        </form>
        <Link href="/buscar" aria-label="Buscar" className="lg:hidden"><IconSearch className="h-5 w-5" /></Link>
        <UserMenu loggedIn={!!user} displayName={profile?.display_name || user?.email || undefined} tz={getTz()} telegramUrl={process.env.NEXT_PUBLIC_TELEGRAM_URL || undefined} />
      </div>
    </header>
  );
}
