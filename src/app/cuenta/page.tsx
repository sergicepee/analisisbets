import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Header } from "@/components/Header";
import { Notice } from "@/components/ui";
import { authConfigured, createAuthServer, getUser } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { IconCalendar, IconGo, IconLogOut, IconMail, IconSettings, IconUser } from "@/components/icons";

export const dynamic = "force-dynamic";

async function saveName(formData: FormData) {
  "use server";
  const user = await getUser();
  if (!user) return;
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  await createAuthServer().from("profiles").upsert({ id: user.id, display_name: name || null, updated_at: new Date().toISOString() });
  revalidatePath("/cuenta");
  revalidatePath("/");
}

export default async function Page() {
  if (!authConfigured()) {
    return <><Header back="/" /><main className="px-4 pt-6"><Notice tone="warn">La autenticación aún no está configurada (ver README).</Notice></main></>;
  }
  const user = await getUser();
  if (!user) redirect("/login");
  const { data: profile } = await createAuthServer().from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const provider = (user.app_metadata?.provider as string | undefined) ?? "email";
  const since = new Date(user.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const name = profile?.display_name || user.email || "Usuario";

  return (
    <>
      <Header back="/" />
      <main className="space-y-5 px-4 pt-6 lg:mx-auto lg:max-w-3xl lg:pt-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Gollab</p>
          <h1 className="mt-1 text-3xl font-black">Perfil</h1>
        </div>

        <section className="relative overflow-hidden rounded-2xl border border-line bg-card">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,15,19,.92),rgba(5,15,19,.54)),url('/images/profile-stadium.jpg')] bg-cover bg-center" />
          <div className="relative flex min-h-44 items-center gap-4 p-5 sm:p-7">
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-2 border-white/20 bg-win text-3xl font-black text-black shadow-xl">{name.trim()[0]?.toUpperCase() || "U"}</div>
            <div className="min-w-0">
              <h2 className="break-words text-xl font-extrabold text-white sm:text-2xl">{name}</h2>
              <p className="mt-2 flex items-center gap-2 break-all text-sm text-slate-200"><IconMail className="h-4 w-4 shrink-0" />{user.email}</p>
              <p className="mt-2 flex items-center gap-2 text-xs text-slate-300"><IconCalendar className="h-4 w-4 shrink-0" />Miembro desde {since}</p>
            </div>
          </div>
        </section>

        <section className="card p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/15 text-brand"><IconUser className="h-5 w-5" /></span><div><h2 className="font-bold">Datos del perfil</h2><p className="text-xs text-muted">Personaliza cómo aparece tu cuenta</p></div></div>
          <form action={saveName} className="space-y-3">
            <label htmlFor="profile-name" className="block text-xs font-semibold text-muted">Nombre visible</label>
            <input id="profile-name" name="name" defaultValue={profile?.display_name ?? ""} maxLength={60} placeholder="Tu nombre" className="w-full rounded-xl border border-line bg-card2 px-4 py-3 text-sm outline-none focus:border-brand" />
            <button className="rounded-xl bg-brand px-5 py-2.5 text-sm font-extrabold text-black">Guardar cambios</button>
          </form>
        </section>

        <section className="card divide-y divide-line overflow-hidden">
          <div className="flex items-center gap-3 p-4"><IconMail className="h-5 w-5 text-muted" /><span className="min-w-0 flex-1"><span className="block text-xs text-muted">Correo electrónico</span><span className="block break-all text-sm font-semibold">{user.email}</span></span></div>
          <div className="flex items-center gap-3 p-4"><IconSettings className="h-5 w-5 text-muted" /><span className="min-w-0 flex-1"><span className="block text-xs text-muted">Método de acceso</span><span className="text-sm font-semibold capitalize">{provider}</span></span></div>
          {provider === "email" && <Link href="/recuperar" className="flex items-center gap-3 p-4 text-sm font-semibold hover:bg-card2"><IconSettings className="h-5 w-5 text-muted" />Cambiar contraseña<IconGo className="ml-auto h-4 w-4 text-muted" /></Link>}
          <Link href="/estado" className="flex items-center gap-3 p-4 text-sm font-semibold hover:bg-card2"><IconSettings className="h-5 w-5 text-muted" />Estado del sistema<IconGo className="ml-auto h-4 w-4 text-muted" /></Link>
        </section>

        <form action="/auth/signout" method="post" className="pb-6">
          <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-loss/50 py-3 text-sm font-bold text-loss hover:bg-loss/10"><IconLogOut className="h-4 w-4" />{t("Cerrar sesión")}</button>
        </form>
      </main>
    </>
  );
}
