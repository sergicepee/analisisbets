"use client";

import { useRouter } from "next/navigation";
import { IconBack } from "./icons";
import { I18nText } from "./I18nProvider";

export function BackButton({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallback);
  }

  return (
    <button
      type="button"
      aria-label="Volver"
      onClick={goBack}
      className="inline-flex items-center gap-2 text-sm font-bold text-muted"
    >
      <IconBack className="h-5 w-5" />
      <span className="sr-only"><I18nText text="Volver" /></span>
    </button>
  );
}
