import Link from "next/link";
import { BRAND } from "@/lib/config";

export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="13" stroke="#adc9a3" strokeWidth="3" strokeDasharray="62 20" strokeLinecap="round" />
      <circle cx="16" cy="16" r="6" stroke="#adc9a3" strokeWidth="2.5" />
      <circle cx="16" cy="16" r="1.8" fill="#adc9a3" />
    </svg>
  );
}
export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <LogoMark />
      <span className="text-lg font-extrabold tracking-[0.18em] text-fg">{BRAND.name.toUpperCase()}</span>
    </Link>
  );
}
