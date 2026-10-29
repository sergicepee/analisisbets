import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Lee un archivo de public/data. En Vercel, los archivos de /public no siempre
// se incluyen en la función serverless (el tracing no detecta rutas dinámicas),
// así que si falla el disco se pide por HTTP al propio despliegue (CDN).
export async function readPublicData(relativePath: string): Promise<string> {
  const file = path.join(process.cwd(), "public", "data", relativePath);
  try {
    return await readFile(file, "utf8");
  } catch (diskError) {
    const host =
      process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, "");
    if (!host) throw diskError;
    const res = await fetch(`https://${host}/data/${relativePath}`, { cache: "force-cache" });
    if (!res.ok) throw new Error(`No se pudo cargar data/${relativePath} (${res.status})`);
    return res.text();
  }
}
