import type { ReactNode } from "react";
import { Header } from "./Header";

export function InfoPage({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <>
      <Header back="/" />
      <main className="space-y-4 px-4 pb-10 pt-6 lg:mx-auto lg:max-w-2xl">
        <h1 className="text-3xl font-black">{title}</h1>
        <div className="space-y-4 text-sm leading-relaxed text-slate-300">{children}</div>
      </main>
    </>
  );
}
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "";
export function Contact({ subject }: { subject: string }) {
  return SUPPORT_EMAIL ? (
    <a className="chip chip-on" href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`}>{SUPPORT_EMAIL}</a>
  ) : (
    <p className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">Configura la variable NEXT_PUBLIC_SUPPORT_EMAIL en Vercel para mostrar aquí tu email de contacto.</p>
  );
}
