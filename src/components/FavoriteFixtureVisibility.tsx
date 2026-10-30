"use client";

import { useEffect, useState, type ReactNode } from "react";

export function FavoriteFixtureVisibility({ fixtureId, children }: { fixtureId: number; children: ReactNode }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const removeFavorite = (event: Event) => {
      const detail = (event as CustomEvent<{ fixtureId: number; favorite: boolean }>).detail;
      if (detail.fixtureId === fixtureId && !detail.favorite) setVisible(false);
    };
    window.addEventListener("pickzone:favorite-updated", removeFavorite);
    return () => window.removeEventListener("pickzone:favorite-updated", removeFavorite);
  }, [fixtureId]);

  return visible ? <>{children}</> : null;
}
