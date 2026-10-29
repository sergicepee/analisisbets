/** Guarda una preferencia en una cookie (1 año). */
export function setPref(name: "gl_lang" | "gl_theme" | "gl_tz", value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}
