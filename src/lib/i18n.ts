import "server-only";
import { getLang } from "./prefs";
import { translate } from "./i18n-dict";

/** Traduce un texto en español al idioma elegido (servidor). */
export const t = (es: string) => translate(getLang(), es);
