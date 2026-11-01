"use client";

import { useEffect, useRef, useState } from "react";
import { liveMinuteLabel } from "@/lib/fixtureStatus";

export function LiveMatchClock({
  statusShort, elapsed, elapsedSeconds, elapsedDisplay,
}: {
  statusShort: string;
  elapsed: number | null;
  elapsedSeconds: number | null | undefined;
  elapsedDisplay: string | null | undefined;
}) {
  const [clock, setClock] = useState(() => ({
    seconds: elapsedSeconds ?? null,
    startedAt: Date.now(),
  }));
  const [now, setNow] = useState(clock.startedAt);
  const previousStatus = useRef(statusShort);
  const stopped = ["HT", "BT", "INT", "SUSP"].includes(statusShort);
  const running = !stopped;

  useEffect(() => {
    if (previousStatus.current !== statusShort) {
      previousStatus.current = statusShort;
      setClock({ seconds: elapsedSeconds ?? null, startedAt: Date.now() });
    }
  }, [statusShort, elapsedSeconds]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setNow(Date.now());
    }, 250);
    return () => window.clearInterval(timer);
  }, [running]);

  if (statusShort === "HT") {
    return (
      <span role="timer" aria-label="Descanso" className="live-match-minute inline-flex whitespace-nowrap text-[10px] font-semibold leading-none tabular-nums tracking-wide text-loss">
        Descanso
      </span>
    );
  }

  const totalSeconds = clock.seconds === null
    ? null
    : clock.seconds + Math.floor((now - clock.startedAt) / 1000);
  const currentMinute = totalSeconds === null ? elapsed : Math.floor(totalSeconds / 60);
  const minuteLabel = liveMinuteLabel(currentMinute, elapsedDisplay);

  return (
    <span role="timer" aria-label={`${minuteLabel} minutos`} className="inline-flex whitespace-nowrap text-[10px] font-semibold leading-none tabular-nums tracking-wide text-loss">
      <span className="live-match-minute">{minuteLabel}′</span>
    </span>
  );
}
