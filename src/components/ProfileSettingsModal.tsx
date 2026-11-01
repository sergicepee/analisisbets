"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createAuthBrowser } from "@/lib/auth-browser";
import { useLang } from "./I18nProvider";
import { SettingsOptions } from "./SettingsModal";
import { IconCalendar, IconCamera, IconGo, IconLock, IconMail, IconTrophy } from "./icons";

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
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const client = createAuthBrowser();
  const nameParts = (name.trim() || emailValue.split("@")[0] || "U").split(/[\s._-]+/).filter(Boolean);
  const initials = (nameParts.length > 1 ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}` : Array.from(nameParts[0] || "U").slice(0, 2).join("")).toUpperCase();
  const memberSince = new Date(createdAt).toLocaleDateString(en ? "en-GB" : "es-ES", { day: "numeric", month: "short", year: "numeric" });

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

  return <div className="space-y-5 sm:space-y-6">
    <header className="space-y-1">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">{tr("Tu espacio", "Your space")}</p>
      <h1 className="text-2xl font-black sm:text-3xl">{tr("Mi perfil", "My profile")}</h1>
      <p className="text-sm text-muted">{tr("Gestiona tu información y personaliza tu experiencia en PICKZONE.", "Manage your information and personalize your PICKZONE experience.")}</p>
    </header>

    <section className="card overflow-hidden">
      <div className="h-1 bg-brand" />
      <div className="flex flex-col gap-5 p-4 sm:flex-row sm:items-center sm:p-6">
        <div className="flex shrink-0 items-center gap-3">
          <div className="grid size-20 place-items-center overflow-hidden rounded-full border-2 border-brand/40 bg-win/15 text-2xl font-black text-brand sm:size-24 sm:text-3xl">
            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initials}
          </div>
          <input ref={photoInput} type="file" accept="image/jpeg,image/png" hidden onChange={uploadPhoto} />
          <button type="button" disabled={busy} onClick={() => photoInput.current?.click()} aria-label={tr("Cambiar foto de perfil", "Change profile picture")} className="grid size-9 place-items-center rounded-full border border-line bg-card2 text-fg hover:border-brand disabled:opacity-50">
            <IconCamera className="size-4" />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-extrabold sm:text-2xl">{name || emailValue}</h2>
          <p className="mt-1 flex min-w-0 items-center gap-2 text-sm text-muted"><IconMail className="size-4 shrink-0" /><span className="truncate">{emailValue}</span></p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card2 px-3 py-1 text-xs font-semibold text-muted"><IconCalendar className="size-3.5" />{tr("Miembro desde", "Member since")} {memberSince}</span>
            <span className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-bold text-brand">{provider === "email" ? "Email" : provider}</span>
          </div>
          <p className="mt-2 text-[11px] text-muted">JPG o PNG · {tr("Máximo 5 MB", "Up to 5 MB")}</p>
        </div>
      </div>
    </section>

    {notice && <p role={noticeError ? "alert" : "status"} className={`rounded-xl border px-3 py-2.5 text-sm ${noticeError ? "border-loss/40 bg-loss/10 text-loss" : "border-win/40 bg-win/10 text-win"}`}>{notice}</p>}

    <div className="grid gap-5 lg:grid-cols-2">
      <section className="card min-w-0 p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="text-base font-extrabold">{tr("Información personal", "Personal information")}</h2>
          <p className="mt-1 text-xs text-muted">{tr("Los datos que aparecen en tu cuenta.", "The details shown on your account.")}</p>
        </div>
        <div className="space-y-5">
          <form onSubmit={saveName} className="space-y-2">
            <label htmlFor="profile-name" className="block text-sm font-semibold">{tr("Nombre", "Name")}</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} autoComplete="name" className={fieldClass} />
              <button type="submit" disabled={busy || !name.trim() || name.trim() === savedName} className={`${actionClass} shrink-0`}>{busy ? tr("Guardando…", "Saving…") : tr("Guardar", "Save")}</button>
            </div>
          </form>

          <div className="space-y-2 border-t border-line pt-4">
            <span className="block text-sm font-semibold">Email</span>
            {!emailEdit ? <div className="flex min-h-11 items-center gap-2 rounded-xl bg-card2 px-3 py-2"><span className="min-w-0 flex-1 break-all text-sm">{emailValue}</span>{provider === "email" && <button type="button" onClick={() => { setEmailEdit(true); setPasswordEdit(false); report(""); }} className={actionClass}>{tr("Editar", "Edit")}</button>}</div> : <form onSubmit={updateEmail} className="space-y-2">
              <input type="email" required autoComplete="email" placeholder={tr("Nuevo correo", "New email")} value={newEmail} onChange={(event) => setNewEmail(event.target.value)} className={fieldClass} />
              <input type="password" required autoComplete="current-password" placeholder={tr("Contraseña actual", "Current password")} value={emailPassword} onChange={(event) => setEmailPassword(event.target.value)} className={fieldClass} />
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={busy} className={`${actionClass} border-brand bg-brand text-black`}>{tr("Enviar confirmación", "Send confirmation")}</button>
                <button type="button" onClick={() => setEmailEdit(false)} className={actionClass}>{tr("Cancelar", "Cancel")}</button>
              </div>
            </form>}
          </div>
        </div>
      </section>

      <section className="card min-w-0 p-4 sm:p-5">
        <div className="mb-4">
          <h2 className="flex items-center gap-2 text-base font-extrabold"><IconLock className="size-4 text-brand" />{tr("Acceso y seguridad", "Sign-in and security")}</h2>
          <p className="mt-1 text-xs text-muted">{tr("Mantén protegida tu cuenta.", "Keep your account secure.")}</p>
        </div>
        {provider !== "email" ? <div className="rounded-xl border border-line bg-card2 p-3 text-sm text-muted">{tr("La contraseña está gestionada por tu proveedor de acceso.", "Your password is managed by your sign-in provider.")}</div> : !passwordEdit ? <div className="flex flex-col gap-3 rounded-xl border border-line bg-card2 p-3 sm:flex-row sm:items-center">
          <span aria-hidden="true" className="flex-1 text-base tracking-[0.3em]">••••••••</span>
          <button type="button" onClick={() => { setPasswordEdit(true); setEmailEdit(false); report(""); }} className={actionClass}>{tr("Cambiar contraseña", "Change password")}</button>
        </div> : <form onSubmit={updatePassword} className="space-y-2">
          <input type="password" required autoComplete="current-password" placeholder={tr("Contraseña actual", "Current password")} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className={fieldClass} />
          <input type="password" required minLength={8} maxLength={128} autoComplete="new-password" placeholder={tr("Nueva contraseña", "New password")} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={fieldClass} />
          <input type="password" required minLength={8} maxLength={128} autoComplete="new-password" placeholder={tr("Confirmar contraseña", "Confirm password")} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={fieldClass} />
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="submit" disabled={busy} className={`${actionClass} border-brand bg-brand text-black`}>{busy ? tr("Guardando…", "Saving…") : tr("Guardar contraseña", "Save password")}</button>
            <button type="button" onClick={() => setPasswordEdit(false)} className={actionClass}>{tr("Cancelar", "Cancel")}</button>
          </div>
        </form>}
      </section>
    </div>

    <section className="card p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="text-base font-extrabold">{tr("Preferencias", "Preferences")}</h2>
        <p className="mt-1 text-xs text-muted">{tr("Ajusta PICKZONE a tu idioma, tema y horario.", "Choose your language, theme and time zone.")}</p>
      </div>
      <SettingsOptions tz={tz} />
    </section>

    <section className="grid gap-3 sm:grid-cols-2">
      <Link href="/favoritos" className="card group flex items-center gap-3 p-4 transition hover:border-brand/50">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-win/10 text-win"><IconGo className="size-5" /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{tr("Mis favoritos", "My favorites")}</span><span className="mt-0.5 block text-xs text-muted">{tr("Accede a tus equipos y partidos guardados.", "View your saved teams and matches.")}</span></span>
        <IconGo className="size-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" />
      </Link>
      <Link href="/premium" className="card group flex items-center gap-3 p-4 transition hover:border-brand/50">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand"><IconTrophy className="size-5" /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{tr("PICKZONE Premium", "PICKZONE Premium")}</span><span className="mt-0.5 block text-xs text-muted">{tr("Consulta las opciones de tu suscripción.", "View your subscription options.")}</span></span>
        <IconGo className="size-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" />
      </Link>
    </section>
  </div>;
}
