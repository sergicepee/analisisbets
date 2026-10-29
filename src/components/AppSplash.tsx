"use client";

import { useEffect, useState } from "react";

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
      <svg className="app-launch-mark" width="180" height="180" viewBox="0 0 32 32" fill="none">
        <circle className="app-launch-orbit" cx="16" cy="16" r="11.44" stroke="#ff3347" strokeWidth="2.64" strokeDasharray="54.56 17.6" strokeLinecap="round" />
        <circle cx="16" cy="16" r="5.28" stroke="#ff3347" strokeWidth="2.2" />
        <circle cx="16" cy="16" r="1.58" fill="#ff3347" />
      </svg>
    </div>
  );
}
