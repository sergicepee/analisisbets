"use client";
import Link from "next/link";
import { useState } from "react";
import { createAuthBrowser } from "@/lib/auth-browser";

type Mode = "login" | "register" | "recover" | "reset";

const TITLE: Record<Mode, string> = {
  login: "Iniciar sesión", register: "Crear cuenta", recover: "Recuperar contraseña", reset: "Nueva contraseña",
};
const SUBMIT: Record<Mode, string> = {
  login: "Entrar", register: "Crear cuenta", recover: "Enviar enlace", reset: "Guardar contraseña",
};

function tr(msg: string): string {
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

export function AuthForm({ mode, initialError }: { mode: Mode; initialError?: string }) {
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
    if ((mode === "register" || mode === "reset") && password.length < 6) return setError("La contraseña debe tener al menos 6 caracteres.");
    if ((mode === "register" || mode === "reset") && password !== confirm) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    const sb = createAuthBrowser();
    try {
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/cuenta";
        return;
      }
      if (mode === "register") {
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: `${origin()}/auth/callback?next=/cuenta` } });
        if (error) throw error;
        if (data.session) { window.location.href = "/cuenta"; return; }
        setInfo("Cuenta creada. Te enviamos un email para confirmarla: ábrelo y pulsa el enlace.");
      }
      if (mode === "recover") {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${origin()}/auth/callback?next=/restablecer` });
        if (error) throw error;
        setInfo("Si el email existe, recibirás un enlace para crear una contraseña nueva.");
      }
      if (mode === "reset") {
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw error;
        window.location.href = "/cuenta";
        return;
      }
    } catch (err) {
      setError(tr(err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    const { error } = await createAuthBrowser().auth.signInWithOAuth({
      provider: "google", options: { redirectTo: `${origin()}/auth/callback?next=/cuenta` },
    });
    if (error) setError(tr(error.message));
  }

  const input = "w-full rounded-xl border border-line bg-card px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-brand";
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black">{TITLE[mode]}</h1>
      {mode === "recover" && <p className="text-sm text-muted">Escribe tu email y te enviaremos un enlace para crear una contraseña nueva.</p>}

      {(mode === "login" || mode === "register") && (
        <>
          <button type="button" onClick={google} className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-white py-3 text-sm font-bold text-black">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.700 16.100 19 13 24 13c3.100 0 5.800 1.200 8 3l5.700-5.700C34 6.100 29.300 4 24 4 16.300 4 9.700 8.300 6.300 14.700z" />
              <path fill="#4CAF50" d="M24 44c5.200 0 9.900-2 13.400-5.200l-6.200-5.200C29.200 35.100 26.700 36 24 36c-5.200 0-9.600-3.300-11.300-8l-6.500 5C9.500 39.600 16.200 44 24 44z" />
              <path fill="#1976D2" d="M43.600 20.100H42V20H24v8h11.300c-.8 2.200-2.200 4.200-4.100 5.600l6.200 5.200C37 39.200 44 34 44 24c0-1.300-.1-2.600-.4-3.900z" />
            </svg>
            Continuar con Google
          </button>
          <div className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />o con tu email<span className="h-px flex-1 bg-line" /></div>
        </>
      )}

      <form onSubmit={submit} className="space-y-3">
        {mode !== "reset" && (
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className={input} />
        )}
        {mode !== "recover" && (
          <input type="password" required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === "reset" ? "Nueva contraseña" : "Contraseña"} className={input} />
        )}
        {(mode === "register" || mode === "reset") && (
          <input type="password" required minLength={6} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repite la contraseña" className={input} />
        )}
        {error && <div role="alert" className="rounded-xl border border-loss/40 bg-loss/10 px-3 py-2.5 text-xs text-loss">{error}</div>}
        {info && <div role="status" className="rounded-xl border border-win/40 bg-win/10 px-3 py-2.5 text-xs text-win">{info}</div>}
        <button disabled={busy} className="w-full rounded-xl bg-brand py-3 text-sm font-extrabold text-black disabled:opacity-60">
          {busy ? "Un momento…" : SUBMIT[mode]}
        </button>
      </form>

      <div className="space-y-1.5 text-center text-sm text-muted">
        {mode === "login" && (<>
          <div><Link href="/recuperar" className="text-brand">¿Olvidaste tu contraseña?</Link></div>
          <div>¿No tienes cuenta? <Link href="/registro" className="font-semibold text-brand">Regístrate</Link></div>
        </>)}
        {mode === "register" && <div>¿Ya tienes cuenta? <Link href="/login" className="font-semibold text-brand">Inicia sesión</Link></div>}
        {mode === "recover" && <div><Link href="/login" className="font-semibold text-brand">Volver a iniciar sesión</Link></div>}
      </div>
    </div>
  );
}
