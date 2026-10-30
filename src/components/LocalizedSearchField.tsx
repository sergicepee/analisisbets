"use client";

import { useT } from "./I18nProvider";

export function LocalizedSearchField({ name = "q", defaultValue, autoFocus = false, className }: { name?: string; defaultValue?: string; autoFocus?: boolean; className: string }) {
  const t = useT();
  return <input name={name} defaultValue={defaultValue} autoFocus={autoFocus} placeholder={t("Buscar equipos, ligas...")} className={className} />;
}
