"use client";
import { useEffect, useState } from "react";

export function Shield({ src, fallbackSrc, alt, size = 40 }: { src: string | null; fallbackSrc?: string | null; alt: string; size?: number }) {
  const [stage, setStage] = useState(0);
  useEffect(() => setStage(0), [src, fallbackSrc]);
  const candidates = [src, fallbackSrc, src?.replace("raw.githubusercontent.com/JoseArroyave/football-logos/main/", "raw.githubusercontent.com/JoseArroyave/football-logos/refs/heads/main/"), fallbackSrc?.replace("@latest/", "@main/")].filter((value, index, all): value is string => !!value && all.indexOf(value) === index);
  const imageSrc = candidates[stage];
  if (!imageSrc) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" role="img" aria-label={alt}>
        <path d="M12 2 4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5l-8-3Z" fill="#1b242c" stroke="#3a4753" strokeWidth="1.2" />
        <circle cx="12" cy="11" r="3" fill="#3a4753" />
      </svg>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={imageSrc} alt={alt} width={size} height={size} loading="lazy" onError={() => setStage((current) => current + 1)} className="object-contain" style={{ width: size, height: size }} />;
}

export function Flag({ src }: { src: string | null }) {
  if (!src) return <span className="inline-block h-3.5 w-5 rounded-sm bg-line" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={20} height={14} loading="lazy" className="h-3.5 w-5 rounded-sm object-cover" />;
}
