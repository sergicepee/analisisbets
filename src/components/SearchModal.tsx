"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useLang, useSearchModal, useT } from "./I18nProvider";
import { IconSearch, IconGo } from "./icons";
import { Shield, Flag } from "./Shield";
import { getLeagueLogoUrl } from "@/lib/leagueLogo";
import type { LeagueInfo } from "@/lib/types";
import type { TeamHit } from "@/lib/apifootball";

type SearchResults = { leagues: LeagueInfo[]; teams: TeamHit[] };

export function SearchLauncher({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  const [, setOpen] = useSearchModal();
  const t = useT();
  return (
    <button type="button" onClick={() => setOpen(true)} aria-label={t("Buscar")} className={className}>
      {children ?? <IconSearch className="h-5 w-5" />}
    </button>
  );
}

export function SearchModal() {
  const [open, setOpen] = useSearchModal();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({ leagues: [], teams: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const lang = useLang();
  const t = useT();
  const normalizedQuery = query.trim();

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, setOpen]);

  useEffect(() => {
    if (!open || normalizedQuery.length < 2) {
      setResults({ leagues: [], teams: [] });
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(normalizedQuery)}`, { signal: controller.signal });
        const data = await response.json() as SearchResults & { error?: string };
        if (!response.ok) throw new Error(data.error || t("No se pudo completar la búsqueda."));
        setResults(data);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setResults({ leagues: [], teams: [] });
          setError(cause instanceof Error ? cause.message : t("No se pudo completar la búsqueda."));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [normalizedQuery, open, t]);

  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/70 px-4 pt-5 backdrop-blur-sm sm:pt-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-modal-title"
        className="mx-auto flex max-h-[min(80vh,680px)] w-full max-w-[420px] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="search-modal-title" className="font-display text-xl font-extrabold"><span>{t("Buscar")}</span></h2>
          <button type="button" onClick={() => setOpen(false)} aria-label={t("Cerrar")} className="rounded-md p-1.5 text-muted transition hover:bg-card2 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="relative px-3 pt-3">
          <IconSearch className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("Buscar equipos, ligas...")}
            aria-label={t("Buscar equipos, ligas...")}
            className="w-full rounded-xl border border-line bg-bg py-3 pl-9 pr-3 text-sm outline-none placeholder:text-muted focus:border-brand"
          />
        </div>
        <div aria-live="polite" className="min-h-24 overflow-y-auto px-3 pb-4 pt-3">
          {normalizedQuery.length < 2 ? (
            <p className="px-5 py-5 text-center text-sm text-muted">{t("Escribe al menos 2 letras para buscar equipos o ligas.")}</p>
          ) : loading ? (
            <p className="px-5 py-5 text-center text-sm text-muted">{t("Buscando...")}</p>
          ) : error ? (
            <p role="alert" className="px-5 py-5 text-center text-sm text-loss">{error}</p>
          ) : results.leagues.length === 0 && results.teams.length === 0 ? (
            <p className="px-5 py-5 text-center text-sm text-muted">{t("No se encontraron equipos o ligas.")}</p>
          ) : (
            <div className="space-y-4">
              {results.leagues.length > 0 && (
                <section className="space-y-1.5">
                  <h3 className="px-2 text-xs font-bold uppercase tracking-wide text-muted">{t("Ligas")}</h3>
                  {results.leagues.map((league) => (
                    <button key={league.id} type="button" onClick={() => navigate(`/liga/${league.id}`)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-card2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white p-1">
                        <Shield src={getLeagueLogoUrl(league.id, league.logo)} alt="" size={28} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{league.name}</span>
                        <span className="flex items-center gap-1.5 text-xs text-muted"><Flag src={league.flag} />{displayCountry(league.country, league.flag, lang)}</span>
                      </span>
                      <IconGo className="h-4 w-4 shrink-0 text-muted" />
                    </button>
                  ))}
                </section>
              )}
              {results.teams.length > 0 && (
                <section className="space-y-1.5">
                  <h3 className="px-2 text-xs font-bold uppercase tracking-wide text-muted">{t("Equipos")}</h3>
                  {results.teams.map((team) => (
                    <button key={team.id} type="button" onClick={() => navigate(`/equipo/${team.id}?name=${encodeURIComponent(team.name)}${team.leagueId ? `&league=${team.leagueId}` : ""}`)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-card2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                      <Shield src={team.logo} fallbackSrc={team.logoFallback} alt={team.name} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{team.name}</span>
                        <span className="block truncate text-xs text-muted">{team.country}</span>
                      </span>
                      <IconGo className="h-4 w-4 shrink-0 text-muted" />
                    </button>
                  ))}
                </section>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function displayCountry(name: string, flag: string | null, lang: "es" | "en") {
  if (name === "World") return lang === "en" ? "World" : "Mundo";
  if (name === "Europe") return lang === "en" ? "Europe" : "Europa";
  const code = flag?.match(/\/flags\/([a-z]{2})\.svg/i)?.[1];
  if (!code) return name;
  try {
    return new Intl.DisplayNames([lang], { type: "region" }).of(code.toUpperCase()) ?? name;
  } catch {
    return name;
  }
}
