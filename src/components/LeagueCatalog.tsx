"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Flag, Shield } from "./Shield";
import { IconGo } from "./icons";
import { useT } from "./I18nProvider";

type Item = { id: number; name: string; type: string; logo: string | null };
type Group = { country: string; flag: string | null; items: Item[] };

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function LeagueLink({ i }: { i: Item }) {
  return (
    <Link href={`/?league=${i.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-card2 px-3 py-2.5">
      <Shield src={i.logo} alt="" size={28} />
      <div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{i.name}</div><div className="text-xs text-muted">{i.type}</div></div>
      <IconGo className="h-4 w-4 shrink-0 text-muted" />
    </Link>
  );
}

export function LeagueCatalog({ groups, intl, autoFocus }: { groups: Group[]; intl: Item[]; autoFocus?: boolean }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const n = norm(q.trim());
  const filtered = useMemo(() => {
    if (!n) return groups;
    return groups
      .map((g) => (norm(g.country).includes(n) ? g : { ...g, items: g.items.filter((i) => norm(i.name).includes(n)) }))
      .filter((g) => g.items.length);
  }, [n, groups]);
  const intlShown = useMemo(() => (n ? intl.filter((i) => norm(i.name).includes(n)) : intl), [n, intl]);

  return (
    <div className="space-y-4">
      <input autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Buscar liga o país")}
        className="w-full rounded-xl border border-line bg-card px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-brand lg:w-72" />
      <div className="lg:grid lg:grid-cols-[1fr_320px] lg:gap-8">
        <div className="space-y-4">
          <h2 className="font-bold">{t("Todas las ligas")}</h2>
          {filtered.map((g) => {
            const expanded = open[g.country] || !!n;
            const items = expanded ? g.items : g.items.slice(0, 3);
            return (
              <section key={g.country} className="card space-y-3 p-3">
                <div className="flex items-center gap-2 px-1">
                  <Flag src={g.flag} />
                  <h3 className="text-xl font-extrabold">{g.country}</h3>
                  <span className="rounded-full bg-brand/15 px-2 py-0.5 text-xs font-bold text-brand">{g.items.length} {t("ligas")}</span>
                </div>
                <div className="grid gap-2 lg:grid-cols-3">{items.map((i) => <LeagueLink key={i.id} i={i} />)}</div>
                {g.items.length > 3 && !n && (
                  <button onClick={() => setOpen((o) => ({ ...o, [g.country]: !o[g.country] }))} className="rounded-xl border border-line bg-card2 px-4 py-2 text-sm font-semibold">
                    {expanded ? t("Ver menos") : t("Ver todas")}
                  </button>
                )}
              </section>
            );
          })}
          {!filtered.length && !intlShown.length && <p className="text-sm text-muted">{t("Sin resultados.")}</p>}
        </div>
        {intlShown.length > 0 && (
          <aside className="mt-4 space-y-2 lg:mt-0">
            <h2 className="font-bold">{t("Competiciones internacionales")}</h2>
            <div className="space-y-2 lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
              {intlShown.slice(0, n ? 50 : 14).map((i) => <LeagueLink key={i.id} i={i} />)}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
