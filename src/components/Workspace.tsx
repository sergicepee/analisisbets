import type { ReactNode } from "react";

/** Móvil: una columna. Escritorio: lista a la izquierda y detalle a la derecha, con scroll independiente. */
export function Workspace({ list, children, hideListOnMobile = false }: { list: ReactNode; children: ReactNode; hideListOnMobile?: boolean }) {
  return (
    <div className="lg:grid lg:grid-cols-[minmax(380px,0.85fr)_1.15fr] lg:gap-6 lg:px-8">
      <div className={`${hideListOnMobile ? "hidden lg:block" : ""} lg:h-[calc(100vh-4.25rem)] lg:overflow-y-auto lg:pr-2`}>{list}</div>
      <div className="lg:h-[calc(100vh-4.25rem)] lg:overflow-y-auto lg:pr-2">{children}</div>
    </div>
  );
}
