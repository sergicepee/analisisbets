import { getSupabase } from "./supabase";

type Entry = { data: unknown; exp: number };
const mem = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export async function cacheGet<T>(key: string, allowStale = false): Promise<T | null> {
  const m = mem.get(key);
  if (m && (allowStale || m.exp > Date.now())) return m.data as T;
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.from("api_cache").select("data,expires_at").eq("key", key).maybeSingle();
    if (!data) return null;
    const exp = new Date(data.expires_at).getTime();
    if (allowStale || exp > Date.now()) {
      mem.set(key, { data: data.data, exp });
      return data.data as T;
    }
  } catch { /* si Supabase falla seguimos sin caché */ }
  return null;
}

export async function cacheSet(key: string, value: unknown, ttlSec: number) {
  const exp = Date.now() + ttlSec * 1000;
  mem.set(key, { data: value, exp });
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from("api_cache").upsert({ key, data: value, expires_at: new Date(exp).toISOString() });
  } catch { /* ignorar */ }
}

/** Devuelve la copia vigente; si caducó, la sirve mientras refresca en segundo plano. */
export async function cached<T>(
  key: string,
  ttl: number | ((d: T) => number),
  fn: () => Promise<T>,
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;

  const stale = await cacheGet<T>(key, true);
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return stale ?? running;
  const p = (async () => {
    try {
      const fresh = await fn();
      await cacheSet(key, fresh, typeof ttl === "function" ? ttl(fresh) : ttl);
      return fresh;
    } catch (error) {
      if (stale !== null) {
        console.error(`No se pudo actualizar la caché ${key}; se conserva el dato anterior:`, error);
        return stale;
      }
      throw error;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  if (stale !== null) return stale;
  return p;
}
