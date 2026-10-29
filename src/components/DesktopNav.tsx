"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "./I18nProvider";

const ITEMS = [
  { href: "/", label: "Partidos", match: (p: string) => p === "/" || p.startsWith("/match") },
  { href: "/top3", label: "Mejores partidos", match: (p: string) => p.startsWith("/top3") },
  { href: "/stats", label: "Estadísticas", match: (p: string) => p.startsWith("/stats") },
  { href: "/leagues", label: "Ligas", match: (p: string) => p.startsWith("/leagues") },
];
export function DesktopNav() {
  const path = usePathname();
  const t = useT();
  return (
    <nav className="hidden items-center gap-10 lg:flex">
      {ITEMS.map(({ href, label, match }) => (
        <Link key={href} href={href} className={`border-b-2 py-1 text-sm font-semibold ${match(path) ? "border-brand text-white" : "border-transparent text-muted hover:text-white"}`}>{t(label)}</Link>
      ))}
    </nav>
  );
}
