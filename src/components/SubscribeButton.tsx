"use client";

import { useState } from "react";
import { useT } from "./I18nProvider";

export function SubscribeButton({ plan, disabled = false, disabledReason }: { plan: "weekly" | "monthly" | "annual"; disabled?: boolean; disabledReason?: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "No se pudo iniciar el pago.");
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar el pago.");
    } finally {
      setBusy(false);
    }
  }

  return <div>
    <button type="button" disabled={disabled || busy} onClick={subscribe} className="w-full rounded-full bg-brand px-5 py-3 text-sm font-extrabold text-black disabled:cursor-not-allowed disabled:opacity-50">
      {busy ? t("Conectando con Stripe…") : disabled ? t(disabledReason ?? "Plan no configurado") : t("Suscribirme con Stripe")}
    </button>
    {error && <p role="alert" className="mt-2 text-xs text-loss">{t(error)}</p>}
  </div>;
}
