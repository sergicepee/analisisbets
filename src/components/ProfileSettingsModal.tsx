"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { createAuthBrowser } from "@/lib/auth-browser";
import { useLang } from "./I18nProvider";
import { SettingsOptions } from "./SettingsModal";
import { IconCalendar, IconCamera, IconClose, IconGlobe, IconGo, IconLock, IconSettings } from "./icons";

type Props = { userId: string; email: string; displayName: string; avatarUrl: string | null; provider: string; createdAt: string; tz: string };

export function ProfileCard({ userId, email, displayName, avatarUrl, provider, createdAt, tz }: Props) {
  const router = useRouter();
  const lang = useLang();
  const en = lang === "en";
  const tr = (es: string, english: string) => en ? english : es;
  const [name, setName] = useState(displayName);
  const [savedName, setSavedName] = useState(displayName);
  const [avatar, setAvatar] = useState(avatarUrl);
  const [emailValue, setEmailValue] = useState(email);
  const [emailEdit, setEmailEdit] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [passwordEdit, setPasswordEdit] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const client = createAuthBrowser();
  const nameParts = (name.trim() || emailValue.split("@")[0] || "U").split(/[\s._-]+/).filter(Boolean);
  const initials = (nameParts.length > 1 ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}` : Array.from(nameParts[0] || "U").slice(0, 2).join("")).toUpperCase();
  const memberSince = new Date(createdAt).toLocaleDateString(en ? "en-GB" : "es-ES", { day: "numeric", month: "short", year: "numeric" });
  const closeSettings = useCallback(() => { if (!busy) setSettingsOpen(false); }, [busy]);

  useEffect(() => {
    if (!settingsOpen) return;
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const esc = (event: KeyboardEvent) => { if (event.key === "Escape") closeSettings(); };
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
      window.removeEventListener("keydown", esc);
    };
  }, [settingsOpen, closeSettings]);

  function report(text: string, error = false) { setNotice(text); setNoticeError(error); }
  async function saveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = name.trim();
    if (!clean || clean.length > 60) return report(tr("El nombre debe tener entre 1 y 60 caracteres.", "Name must be between 1 and 60 characters."), true);
    setBusy(true); report("");
    try {
      const { error } = await client.from("profiles").upsert({ id: userId, display_name: clean, updated_at: new Date().toISOString() });
      if (error) throw error;
      setName(clean); setSavedName(clean); report(tr("Nombre guardado.", "Name saved.")); router.refresh();
    } catch (error) { report(error instanceof Error ? error.message : tr("No se pudo guardar el nombre.", "Could not save the name."), true); }
    finally { setBusy(false); }
  }
  async function updateEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = newEmail.trim();
    if (!nextEmail || nextEmail.toLowerCase() === emailValue.toLowerCase()) return report(tr("Introduce un correo distinto y válido.", "Enter a different valid email."), true);
    setBusy(true); report("");
    try {
      const { error: authError } = await client.auth.signInWithPassword({ email, password: emailPassword });
      if (authError) throw new Error(tr("La contraseña actual no es correcta.", "The current password is incorrect."));
      const { error } = await client.auth.updateUser({ email: nextEmail });
      if (error) throw error;
      setEmailEdit(false); setNewEmail(""); setEmailPassword("");
      report(tr("Te enviamos un enlace para confirmar el cambio de correo.", "We sent a link to confirm the email change."));
    } catch (error) { report(error instanceof Error ? error.message : tr("No se pudo cambiar el correo.", "Could not change the email."), true); }
    finally { setBusy(false); }
  }
  async function updatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 8 || newPassword.length > 128) return report(tr("La contraseña nueva debe tener entre 8 y 128 caracteres.", "The new password must be 8 to 128 characters."), true);
    if (newPassword !== confirmPassword) return report(tr("Las contraseñas no coinciden.", "The passwords do not match."), true);
    setBusy(true); report("");
    try {
      const { error: authError } = await client.auth.signInWithPassword({ email, password: currentPassword });
      if (authError) throw new Error(tr("La contraseña actual no es correcta.", "The current password is incorrect."));
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordEdit(false); setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      report(tr("Contraseña actualizada.", "Password updated."));
    } catch (error) { report(error instanceof Error ? error.message : tr("No se pudo cambiar la contraseña.", "Could not update the password."), true); }
    finally { setBusy(false); }
  }
  async function uploadPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!(["image/jpeg", "image/png"].includes(file.type)) || file.size > 5 * 1024 * 1024) return report(tr("Elige una imagen JPG o PNG de hasta 5 MB.", "Choose a JPG or PNG image up to 5 MB."), true);
    setBusy(true); report("");
    try {
      const image = await createImageBitmap(file);
      const valid = image.width * image.height <= 16_000_000;
      image.close();
      if (!valid) throw new Error(tr("La imagen no puede superar los 16 megapíxeles.", "The image must be 16 megapixels or smaller."));
      const ext = file.type === "image/png" ? "png" : "jpg";
      const path = `${userId}/avatar.${ext}`;
      const { error: uploadError } = await client.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const baseUrl = client.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      const publicUrl = `${baseUrl}?v=${Date.now()}`;
      const { error: profileError } = await client.from("profiles").update({ avatar_url: publicUrl, updated_at: new Date().toISOString() }).eq("id", userId);
      if (profileError) throw profileError;
      setAvatar(publicUrl); report(tr("Foto actualizada.", "Profile photo updated.")); router.refresh();
    } catch (error) { report(error instanceof Error ? error.message : tr("No se pudo subir la foto. Comprueba que el almacenamiento de avatares esté configurado.", "Could not upload the photo. Check that avatar storage is configured."), true); }
    finally { setBusy(false); }
  }

  const fieldClass = "w-full min-w-0 rounded-xl border border-line bg-card2 px-3 py-3 text-sm outline-none focus:border-brand";
  const actionClass = "inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-card2 px-4 py-2.5 text-sm font-bold hover:border-brand disabled:opacity-50";

  return <>
    <section className="relative isolate overflow-hidden rounded-2xl border border-line bg-card text-white">
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(5,15,19,.92),rgba(5,15,19,.54)),url('/images/profile-stadium.jpg')] bg-cover bg-center" />
      <div className="flex min-h-32 items-center gap-4 p-4 sm:min-h-36 sm:gap-5 sm:p-6">
        <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-brand/40 bg-win/20 text-xl font-black text-brand sm:h-20 sm:w-20 sm:text-2xl">{avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initials}</div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-extrabold sm:text-2xl">{name || email}</h1>
          <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-200 sm:text-sm"><IconGlobe className="h-4 w-4 shrink-0" />{tr("Idioma", "Language")}: {lang.toUpperCase()}</p>
          <p className="mt-1.5 flex items-center gap-2 text-xs text-slate-200 sm:text-sm"><IconCalendar className="h-4 w-4 shrink-0" />{tr("Miembro desde", "Member since")} {memberSince}</p>
        </div>
        <button type="button" onClick={() => setSettingsOpen(true)} aria-label={tr("Configuración del perfil", "Profile settings")} title={tr("Configuración del perfil", "Profile settings")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-black/25 text-slate-200 hover:bg-black/45 sm:h-12 sm:w-12"><IconSettings className="h-5 w-5" /></button>
      </div>
    </section>
    {settingsOpen && createPortal(<div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 p-5 max-[720px]:p-0" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSettings(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="profile-settings-title" className="flex max-h-[calc(100dvh-2.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line bg-bg shadow-2xl max-[720px]:h-[100dvh] max-[720px]:max-h-none max-[720px]:max-w-none max-[720px]:rounded-none max-[720px]:border-0">
      <header className="flex shrink-0 items-center gap-4 border-b border-line px-5 py-4 sm:px-7">
        <h2 id="profile-settings-title" className="flex-1 text-xl font-extrabold sm:text-2xl">{tr("Configuración del perfil", "Profile settings")}</h2>
        <button type="button" onClick={closeSettings} disabled={busy} aria-label={tr("Cerrar", "Close")} className="grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-card2"><IconClose className="h-5 w-5" /></button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:space-y-5 sm:px-7 sm:py-5">
        {notice && <p role={noticeError ? "alert" : "status"} className={`rounded-xl border px-3 py-2 text-sm ${noticeError ? "border-loss/40 bg-loss/10 text-loss" : "border-win/40 bg-win/10 text-win"}`}>{notice}</p>}
        <section className="rounded-2xl border border-line p-4 sm:p-5">
          <h3 className="mb-4 text-base font-extrabold">{tr("Información personal", "Personal information")}</h3>
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_185px] md:gap-7">
            <div className="space-y-4">
              <form onSubmit={saveName} className="space-y-2">
                <label htmlFor="profile-settings-name" className="block text-sm text-muted">{tr("Nombre", "Name")}</label>
                <div className="flex gap-2"><input id="profile-settings-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="name" className={fieldClass} /><button type="submit" disabled={busy || !name.trim() || name.trim() === savedName} className={actionClass}>{tr("Guardar", "Save")}</button></div>
              </form>
              <div className="space-y-2">
                <span className="block text-sm text-muted">Email</span>
                {!emailEdit ? <div className="flex min-h-11 items-center gap-2"><span className="min-w-0 flex-1 break-all text-sm">{emailValue}</span>{provider === "email" && <button type="button" onClick={() => { setEmailEdit(true); setPasswordEdit(false); report(""); }} className={actionClass}>{tr("Editar", "Edit")}</button>}</div> : <form onSubmit={updateEmail} className="space-y-2"><input type="email" required autoComplete="email" placeholder={tr("Nuevo correo", "New email")} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={fieldClass} /><input type="password" required autoComplete="current-password" placeholder={tr("Contraseña actual", "Current password")} value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} className={fieldClass} /><div className="flex gap-2"><button type="submit" disabled={busy} className={`${actionClass} border-brand bg-brand text-black`}>{tr("Enviar confirmación", "Send confirmation")}</button><button type="button" onClick={() => setEmailEdit(false)} className={actionClass}>{tr("Cancelar", "Cancel")}</button></div></form>}
              </div>
              <div className="space-y-2">
                <span className="flex items-center gap-2 text-sm text-muted"><IconLock className="h-4 w-4" />{tr("Contraseña", "Password")}</span>
                {provider !== "email" ? <span className="text-sm text-muted">{tr("Gestionada por tu proveedor de acceso.", "Managed by your sign-in provider.")}</span> : !passwordEdit ? <div className="flex min-h-11 items-center gap-2"><span aria-hidden="true" className="flex-1 text-base tracking-[0.3em]">••••••••</span><button type="button" onClick={() => { setPasswordEdit(true); setEmailEdit(false); report(""); }} className={actionClass}>{tr("Cambiar contraseña", "Change password")}</button></div> : <form onSubmit={updatePassword} className="space-y-2"><input type="password" required autoComplete="current-password" placeholder={tr("Contraseña actual", "Current password")} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={fieldClass} /><input type="password" required minLength={8} maxLength={128} autoComplete="new-password" placeholder={tr("Nueva contraseña", "New password")} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={fieldClass} /><input type="password" required minLength={8} maxLength={128} autoComplete="new-password" placeholder={tr("Confirmar contraseña", "Confirm password")} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={fieldClass} /><div className="flex gap-2"><button type="submit" disabled={busy} className={`${actionClass} border-brand bg-brand text-black`}>{tr("Guardar contraseña", "Save password")}</button><button type="button" onClick={() => setPasswordEdit(false)} className={actionClass}>{tr("Cancelar", "Cancel")}</button></div></form>}
              </div>
            </div>
            <div className="flex flex-col items-center border-t border-line pt-4 text-center md:border-l md:border-t-0 md:pl-6 md:pt-1">
              <span className="text-sm text-muted">{tr("Foto del perfil", "Profile picture")}</span>
              <div className="my-3 grid h-24 w-24 place-items-center overflow-hidden rounded-full border-2 border-win/50 bg-win/20 text-3xl font-extrabold text-brand">{avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initials}</div>
              <input ref={photoInput} type="file" accept="image/jpeg,image/png" hidden onChange={uploadPhoto} />
              <button type="button" disabled={busy} onClick={() => photoInput.current?.click()} className={actionClass}><IconCamera className="mr-2 h-4 w-4" />{tr("Cambiar foto", "Change photo")}</button>
              <small className="mt-2 text-xs text-muted">JPG, PNG. {tr("Máx. 5 MB", "Max 5 MB")}</small>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-line">
          <button type="button" aria-expanded={preferencesOpen} onClick={() => setPreferencesOpen((open) => !open)} className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left text-sm font-bold hover:bg-card2"><IconSettings className="h-5 w-5" /><span className="flex-1">{tr("Idioma, tema y zona horaria", "Language, theme and time zone")}</span><IconGo className={`h-4 w-4 text-muted transition-transform ${preferencesOpen ? "rotate-90" : ""}`} /></button>
          {preferencesOpen && <div className="border-t border-line p-3 sm:p-4"><SettingsOptions tz={tz} /></div>}
        </section>
      </div>
    </section>
  </div>, document.body)}
  </>;
}
