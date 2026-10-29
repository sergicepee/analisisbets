"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconMatches, IconStats, IconTrophy } from "./icons";

const ITEMS = [
  { href: "/", label: "Partidos", Icon: IconMatches, match: (p: string) => p === "/" || p.startsWith("/match") },
  { href: "/top3", label: "Los 3 mejores", Icon: IconTrophy, match: (p: string) => p.startsWith("/top3") },
  { href: "/stats", label: "Estadísticas", Icon: IconStats, match: (p: string) => p.startsWith("/stats") },
  { href: "/leagues", label: "Ligas", Icon: IconTrophy, match: (p: string) => p.startsWith("/leagues") },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 lg:hidden border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-3xl">
        {ITEMS.map(({ href, label, Icon, match }) => {
          const on = match(path);
          return (
            <Link key={href} href={href} className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${on ? "text-brand" : "text-muted"}`}>
              <Icon className="h-5 w-5" />
              <span className={on ? "border-b-2 border-brand pb-0.5" : "pb-0.5"}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
