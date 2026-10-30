"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star } from "lucide-react";
import { useT } from "./I18nProvider";

const ITEMS = [
  { href: "/", label: "Partidos", match: (p: string) => p === "/" || p.startsWith("/match") },
  { href: "/stats", label: "Estadísticas", match: (p: string) => p.startsWith("/stats") },
  { href: "/favoritos", label: "Favoritos", match: (p: string) => p.startsWith("/favoritos") },
];
export function DesktopNav() {
  const path = usePathname();
  const t = useT();
  return (
    <nav className="hidden items-center gap-10 lg:flex">
      {ITEMS.map(({ href, label, match }) => (
        <Link key={href} href={href} className={`border-b-2 py-1 text-sm font-semibold ${match(path) ? "border-brand text-fg" : "border-transparent text-muted hover:text-fg"}`}>{t(label)}</Link>
      ))}
    </nav>
  );
}
