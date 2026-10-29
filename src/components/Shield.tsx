"use client";
import { useState } from "react";

export function Shield({ src, alt, size = 40 }: { src: string | null; alt: string; size?: number }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" role="img" aria-label={alt}>
        <path d="M12 2 4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5l-8-3Z" fill="#1b242c" stroke="#3a4753" strokeWidth="1.2" />
        <circle cx="12" cy="11" r="3" fill="#3a4753" />
      </svg>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} width={size} height={size} loading="lazy" onError={() => setBad(true)} className="object-contain" style={{ width: size, height: size }} />;
}

export function Flag({ src }: { src: string | null }) {
  if (!src) return <span className="inline-block h-3.5 w-5 rounded-sm bg-line" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={20} height={14} loading="lazy" className="h-3.5 w-5 rounded-sm object-cover" />;
}
