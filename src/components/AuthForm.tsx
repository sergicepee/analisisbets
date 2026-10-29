"use client";
import Link from "next/link";
import { useState } from "react";
import { createAuthBrowser } from "@/lib/auth-browser";
import { BRAND } from "@/lib/config";
import { useT } from "./I18nProvider";
import { IconEye, IconEyeOff } from "./icons";

type Mode = "login" | "register" | "recover" | "reset";

const TITLE: Record<Mode, string> = { login: "Iniciar sesión", register: "Crear cuenta", recover: "Recuperar contraseña", reset: "Nueva contraseña" };
const SUB: Record<Mode, string> = {
  login: "Accede a tu cuenta con email y contraseña.", register: "Crea tu cuenta con email y contraseña.",
  recover: "Escribe tu email y te enviaremos un enlace para crear una contraseña nueva.", reset: "Elige una contraseña nueva para tu cuenta.",
};
const SUBMIT: Record<Mode, string> = { login: "Entrar", register: "Crear cuenta", recover: "Enviar enlace", reset: "Guardar contraseña" };

function known(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Email o contraseña incorrectos.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Ese email ya tiene una cuenta. Inicia sesión.";
  if (m.includes("email not confirmed")) return "Confirma tu email antes de entrar (revisa tu bandeja y el spam).";
  if (m.includes("at least") && m.includes("character")) return "La contraseña debe tener al menos 6 caracteres.";
  if (m.includes("rate limit") || m.includes("too many")) return "Demasiados intentos. Espera unos minutos.";
  if (m.includes("same password")) return "La nueva contraseña debe ser distinta de la anterior.";
  if (m.includes("provider is not enabled") || m.includes("unsupported provider")) return "Google aún no está activado en Supabase (ver README).";
  return msg;
}

function PasswordInput({ value, onChange, placeholder, autoComplete }: { value: string; onChange: (v: string) => void; placeholder: string; autoComplete: string }) {
  const t = useT();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input type={show ? "text" : "password"} required minLength={6} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl border border-line bg-bg px-4 py-3 pr-14 text-sm outline-none placeholder:text-muted focus:border-brand" />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? t("Ocultar contraseña") : t("Mostrar contraseña")}
        className="absolute right-2 top-1/2 flex h-8 w-9 -translate-y-1/2 items-center justify-center rounded-lg border border-line bg-card2 text-slate-300">
        {show ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function AuthForm({ mode, initialError }: { mode: Mode; initialError?: string }) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [info, setInfo] = useState<string | null>(null);
  const origin = () => window.location.origin;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null);
    if ((mode === "register" || mode === "reset") && password.length < 6) return setError(t("La contraseña debe tener al menos 6 caracteres."));
    if ((mode === "register" || mode === "reset") && password !== confirm) return setError(t("Las contraseñas no coinciden."));
    setBusy(true);
    const sb = createAuthBrowser();
    try {
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/cuenta"; return;
      }
      if (mode === "register") {
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: `${origin()}/auth/callback?next=/cuenta` } });
        if (error) throw error;
        if (data.session) { window.location.href = "/cuenta"; return; }
        setInfo(t("Cuenta creada. Te enviamos un email para confirmarla: ábrelo y pulsa el enlace."));
      }
      if (mode === "recover") {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/auth/callback?next=/restablecer` });
        if (error) throw error;
        setInfo(t("Si el email existe, recibirás un enlace para crear una contraseña nueva."));
      }
      if (mode === "reset") {
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw error;
        window.location.href = "/cuenta"; return;
      }
    } catch (err) {
      setError(t(known(err instanceof Error ? err.message : String(err))));
    } finally { setBusy(false); }
  }

  async function google() {
    setError(null);
    const { error } = await createAuthBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${origin()}/auth/callback?next=/cuenta` } });
    if (error) setError(t(known(error.message)));
  }

  const input = "w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-brand";
  const label = "mb-1.5 block text-xs font-semibold text-slate-300";
  return (
    <div>
      <h1 className="text-center text-3xl font-black">{t(TITLE[mode])}</h1>
      <p className="mx-auto mt-2 max-w-xs text-center text-sm text-muted">{t(SUB[mode])}{mode === "login" || mode === "register" ? ` (${BRAND.name})` : ""}</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode !== "reset" && (
          <div><label className={label}>Email</label>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" className={input} /></div>
        )}
        {mode !== "recover" && (
          <div><label className={label}>{mode === "reset" ? t("Nueva contraseña") : t("Contraseña")}</label>
            <PasswordInput value={password} onChange={setPassword} placeholder="" autoComplete={mode === "login" ? "current-password" : "new-password"} />
            {mode === "login" && <div className="mt-2 text-right"><Link href="/recuperar" className="text-xs font-bold text-brand">{t("¿Olvidaste tu contraseña?")}</Link></div>}
          </div>
        )}
        {(mode === "register" || mode === "reset") && (
          <div><label className={label}>{t("Repite la contraseña")}</label>
            <PasswordInput value={confirm} onChange={setConfirm} placeholder="" autoComplete="new-password" /></div>
        )}
        {error && <div role="alert" className="rounded-xl border border-loss/40 bg-loss/10 px-3 py-2.5 text-xs text-loss">{error}</div>}
        {info && <div role="status" className="rounded-xl border border-win/40 bg-win/10 px-3 py-2.5 text-xs text-win">{info}</div>}
        <button disabled={busy} className="w-full rounded-xl bg-brand py-3.5 text-sm font-extrabold text-black disabled:opacity-60">{busy ? t("Un momento…") : t(SUBMIT[mode])}</button>
      </form>

      {(mode === "login" || mode === "register") && (
        <>
          <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />{t("o continúa con")}<span className="h-px flex-1 bg-line" /></div>
          <button type="button" onClick={google} className="flex w-full items-center justify-center gap-3 rounded-xl bg-white py-3 text-sm font-bold text-black">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
            </svg>
            {t("Continuar con Google")}
          </button>
        </>
      )}

      <div className="mt-5 space-y-1.5 text-center text-sm text-muted">
        {mode === "login" && <div>{t("¿No tienes cuenta?")} <Link href="/registro" className="font-bold text-brand">{t("Crear cuenta")}</Link></div>}
        {mode === "register" && <div>{t("¿Ya tienes cuenta?")} <Link href="/login" className="font-bold text-brand">{t("Iniciar sesión")}</Link></div>}
        {mode === "recover" && <div><Link href="/login" className="font-bold text-brand">{t("Volver a iniciar sesión")}</Link></div>}
      </div>
    </div>
  );
}
