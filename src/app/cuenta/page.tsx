import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Header } from "@/components/Header";
import { Notice, Panel } from "@/components/ui";
import { authConfigured, createAuthServer, getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function saveName(formData: FormData) {
  "use server";
  const user = await getUser();
  if (!user) return;
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  await createAuthServer().from("profiles").upsert({ id: user.id, display_name: name || null, updated_at: new Date().toISOString() });
  revalidatePath("/cuenta");
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

  return (
    <>
      <Header back="/" />
      <main className="space-y-4 px-4 pt-6 lg:mx-auto lg:max-w-xl">
        <h1 className="text-3xl font-black">Mi cuenta</h1>
        <Panel title="Datos">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted">Email</span><span className="font-semibold">{user.email}</span></div>
            <div className="flex justify-between"><span className="text-muted">Acceso con</span><span className="font-semibold capitalize">{provider}</span></div>
            <div className="flex justify-between"><span className="text-muted">Miembro desde</span><span className="font-semibold">{since}</span></div>
          </div>
        </Panel>
        <Panel title="Perfil">
          <form action={saveName} className="space-y-3">
            <input name="name" defaultValue={profile?.display_name ?? ""} maxLength={60} placeholder="Tu nombre" className="w-full rounded-xl border border-line bg-card2 px-4 py-3 text-sm outline-none focus:border-brand" />
            <button className="rounded-xl bg-brand px-5 py-2.5 text-sm font-extrabold text-black">Guardar</button>
          </form>
        </Panel>
        <div className="grid grid-cols-2 gap-3">
          {provider === "email" && <Link href="/recuperar" className="chip justify-center">Cambiar contraseña</Link>}
          <Link href="/estado" className="chip justify-center">Estado del sistema</Link>
        </div>
        <form action="/auth/signout" method="post">
          <button className="w-full rounded-xl border border-loss/50 py-3 text-sm font-bold text-loss">Cerrar sesión</button>
        </form>
      </main>
    </>
  );
}
