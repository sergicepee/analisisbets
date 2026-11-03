"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "./I18nProvider";

type DeveloperPreviewMode = "subscriber" | "regular";

type Props = {
  actualSubscriber: boolean;
  initialMode: DeveloperPreviewMode | null;
};

export function DeveloperSubscriptionToggle({ actualSubscriber, initialMode }: Props) {
  const router = useRouter();
  const en = useLang() === "en";
  const [mode, setMode] = useState<DeveloperPreviewMode>(initialMode ?? (actualSubscriber ? "subscriber" : "regular"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function selectMode(nextMode: DeveloperPreviewMode) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/developer/subscription-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: nextMode }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || (en ? "Could not change preview mode." : "No se pudo cambiar el modo de vista."));
      setMode(nextMode);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : (en ? "Could not change preview mode." : "No se pudo cambiar el modo de vista."));
    } finally {
      setBusy(false);
    }
  }

  const optionClass = (selected: boolean) =>
    `min-h-11 rounded-xl border px-4 py-2 text-sm font-bold transition-colors disabled:cursor-wait disabled:opacity-60 ${
      selected ? "border-brand bg-brand/15 text-brand" : "border-line bg-card2 hover:border-brand"
    }`;

  return (
    <section className="card space-y-3 p-4 sm:p-5">
      <div>
        <h2 className="text-sm font-extrabold">{en ? "Developer mode" : "Modo desarrollador"}</h2>
        <p className="mt-1 text-xs text-muted">
          {en
            ? "Preview Premium access without changing your real subscription or payments."
            : "Previsualiza el acceso Premium sin cambiar tu suscripción real ni los pagos."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={optionClass(mode === "subscriber")} aria-pressed={mode === "subscriber"} disabled={busy} onClick={() => void selectMode("subscriber")}>
          {en ? "View as subscriber" : "Ver como suscriptor"}
        </button>
        <button type="button" className={optionClass(mode === "regular")} aria-pressed={mode === "regular"} disabled={busy} onClick={() => void selectMode("regular")}>
          {en ? "View as non-subscriber" : "Ver como no suscriptor"}
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {busy ? (en ? "Changing preview mode…" : "Cambiando modo de vista…") : ""}
      </p>
      {error && <p role="alert" className="text-sm text-loss">{error}</p>}
    </section>
  );
}
