"use client";
import { I18nText } from "@/components/I18nProvider";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6 text-center">
      <p className="mb-3 text-sm text-muted"><I18nText text="No se pudieron cargar los datos. Puede ser un límite de la API o un fallo temporal." /></p>
      <button onClick={reset} className="chip chip-on"><I18nText text="Reintentar" /></button>
    </div>
  );
}
