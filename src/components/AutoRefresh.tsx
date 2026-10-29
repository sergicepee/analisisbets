"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refresca los datos del servidor cada N segundos (solo con la pestaña visible). */
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
