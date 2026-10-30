"use client";

import { useState } from "react";
import { useT } from "./I18nProvider";

export function ManageSubscriptionButton() {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function manage() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "No se pudo abrir Stripe.");
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo abrir Stripe.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="text-center">
    <button type="button" onClick={manage} disabled={busy} className="rounded-full border border-line px-5 py-2.5 text-sm font-bold disabled:opacity-60">
      {busy ? t("Abriendo Stripe…") : t("Gestionar o cancelar suscripción")}
    </button>
    {error && <p role="alert" className="mt-2 text-xs text-loss">{t(error)}</p>}
  </div>;
}
