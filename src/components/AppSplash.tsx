"use client";

import { useEffect, useState } from "react";
import { BRAND } from "@/lib/config";
import { LogoMark } from "./Logo";

export function AppSplash() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

    if (!isStandalone) {
      setVisible(false);
      return;
    }

    document.documentElement.dataset.appStandalone = "true";
    const fadeTimer = window.setTimeout(() => setLeaving(true), 950);
    const hideTimer = window.setTimeout(() => setVisible(false), 1_250);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`app-launch-splash${leaving ? " is-leaving" : ""}`} aria-hidden="true">
      <div className="flex flex-col items-center gap-3">
        <LogoMark size={76} />
        <span className="text-xl font-extrabold tracking-[0.18em] text-white">{BRAND.name}</span>
      </div>
    </div>
  );
}
