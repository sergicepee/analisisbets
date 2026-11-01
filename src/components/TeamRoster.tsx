"use client";

import { useEffect, useState } from "react";
import { I18nText } from "@/components/I18nProvider";
import { jerseyStyle } from "@/lib/teamColor";
import type { TeamRosterPlayer } from "@/lib/types";

type Props = { teamId: number; leagueId?: number; season: number };
type PositionGroup = "goalkeepers" | "defenders" | "midfielders" | "forwards" | "other";

const GROUPS: Array<{ key: PositionGroup; label: string }> = [
  { key: "goalkeepers", label: "Porteros" },
  { key: "defenders", label: "Defensas" },
  { key: "midfielders", label: "Centrocampistas" },
  { key: "forwards", label: "Delanteros" },
  { key: "other", label: "Otros" },
];

function positionGroup(player: TeamRosterPlayer): PositionGroup {
  const position = `${player.position} ${player.positionAbbreviation ?? ""}`.toLowerCase();
  if (/goalkeeper|goalie|keeper|portero|\bg\b/.test(position)) return "goalkeepers";
  if (/defend|defensa|back|\bd\b/.test(position)) return "defenders";
  if (/midfield|centro|medio|\bm\b/.test(position)) return "midfielders";
  if (/forward|striker|wing|attack|delantero|\bf\b/.test(position)) return "forwards";
  return "other";
}

function positionLabel(position: string): string {
  const normalized = position.toLowerCase();
  if (/goalkeeper|goalie|keeper|portero/.test(normalized)) return "Portero";
  if (/center.?back|centre.?back|central/.test(normalized)) return "Defensa central";
  if (/left.?back|lateral izquierdo/.test(normalized)) return "Lateral izquierdo";
  if (/right.?back|lateral derecho/.test(normalized)) return "Lateral derecho";
  if (/defend|defensa|back/.test(normalized)) return "Defensor";
  if (/defensive midfielder|holding midfielder/.test(normalized)) return "Mediocentro defensivo";
  if (/midfield|centro|medio/.test(normalized)) return "Centrocampista";
  if (/wing|extremo/.test(normalized)) return "Extremo";
  if (/forward|striker|attack|delantero/.test(normalized)) return "Delantero";
  return position || "Jugador";
}

function jerseyNumber(jersey: string | null): number {
  const parsed = Number.parseInt(jersey ?? "", 10);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

export function TeamRoster({ teamId, leagueId, season }: Props) {
  const [players, setPlayers] = useState<TeamRosterPlayer[]>([]);
  const [teamColor, setTeamColor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId) {
      setError("No se pudo determinar la competición del equipo.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    async function loadRoster() {
      setLoading(true);
      setError(null);
      setPlayers([]);
      setTeamColor(null);
      try {
        const query = new URLSearchParams({
          teamId: String(teamId),
          leagueId: String(leagueId),
          season: String(season),
        });
        const response = await fetch(`/api/team-roster?${query}`, { signal: controller.signal });
        const data = await response.json() as { players?: TeamRosterPlayer[]; teamColor?: string | null; error?: string };
        if (!response.ok) throw new Error(data.error ?? "No se pudo cargar la plantilla.");
        if (!Array.isArray(data.players)) throw new Error("La respuesta de la plantilla no es válida.");
        setPlayers(data.players);
        setTeamColor(data.teamColor ?? null);
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "No se pudo cargar la plantilla.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadRoster();
    return () => controller.abort();
  }, [teamId, leagueId, season]);

  const groupedPlayers = GROUPS.map((group) => ({
    ...group,
    players: players
      .filter((player) => positionGroup(player) === group.key)
      .sort((a, b) => jerseyNumber(a.jersey) - jerseyNumber(b.jersey)),
  })).filter((group) => group.players.length > 0);

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div aria-live="polite">
        {loading && <p role="status" className="py-5 text-center text-sm text-muted"><I18nText text="Cargando plantilla..." /></p>}
        {!loading && error && <p role="alert" className="py-5 text-center text-sm text-loss"><I18nText text={error} /></p>}
        {!loading && !error && players.length === 0 && <p className="py-5 text-center text-sm text-muted"><I18nText text="No hay plantilla disponible para esta temporada." /></p>}
      </div>

      {!loading && !error && groupedPlayers.map((group) => (
        <section key={group.key} aria-label={group.label}>
          <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-brand">
            <I18nText text={group.label} /> ({group.players.length})
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {group.players.map((player, index) => (
              <li
                key={player.id ?? `${player.name}-${player.jersey ?? index}`}
                className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-bg p-2.5"
              >
                <span
                  role="img"
                  aria-label={`${player.name} #${player.jersey ?? "—"}`}
                  style={jerseyStyle(teamColor)}
                  className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-white/90 bg-emerald-950/90 text-lg font-black shadow"
                >
                  {player.jersey ?? "—"}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{player.name}</span>
                  <span className="block truncate text-[11px] text-muted">
                    <I18nText text={positionLabel(player.position)} />
                    {player.age !== null && <> · {player.age} <I18nText text={player.age === 1 ? "año" : "años"} /></>}
                    {player.nationality && <> · {player.nationality}</>}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
