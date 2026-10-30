import type { } from "react";
export type LangCode = "es" | "en";

/** Clave = texto en español. Si no hay traducción, se muestra el español. */
const EN: Record<string, string> = {
  // navegación
  "Partidos": "Matches", "Mejores partidos": "Top picks", "Los 3 mejores": "Top 3", "La combinada": "Accumulator", "Estadísticas": "Stats", "Ligas": "Leagues",
  "Buscar equipos, ligas...": "Search teams, leagues...",
  // menú de usuario
  "Iniciar sesión": "Sign in", "Mi cuenta": "My account", "Cerrar sesión": "Sign out", "Ajustes": "Settings",
  "Canal de Telegram": "Telegram channel", "Ayuda y soporte": "Help & Support", "Colaboración": "Cooperation",
  // ajustes
  "Idioma": "Language", "Elige tu idioma preferido": "Choose your preferred language",
  "Tema": "Theme", "Elige cómo se ve la web": "Choose how the site looks", "Oscuro": "Dark", "Claro": "Light",
  "Zona horaria": "Time zone", "Elige la hora local de los partidos": "Choose the local time for matches",
  "Usar la zona horaria del dispositivo": "Use device time zone", "Cerrar": "Close",
  // fechas y filtros
  "Ayer": "Yesterday", "Hoy": "Today", "Mañana": "Tomorrow",
  "Todos": "All", "En vivo": "Live", "Finalizados": "Finished", "Próximos": "Upcoming",
  "Final": "Finished",
  "Pendientes de actualizar": "Awaiting update", "Pendiente de actualizar": "Awaiting update", "Otros": "Other",
  "Liga:": "League:", "No hay partidos para este filtro y fecha.": "No matches for this filter and date.",
  "No se pudo cargar el listado:": "Could not load the list:",
  "Local": "Home", "Visitante": "Away", "Empate": "Draw",
  // ficha
  "General": "General", "Goles": "Goals", "Tiros": "Shots", "Esquinas": "Corners", "Tarjetas": "Cards",
  "Probabilidades clave": "Key probabilities",
  "Más de 2,5 goles": "Over 2.5 goals", "Más de 1,5 goles": "Over 1.5 goals", "Ambos marcan": "Both teams to score",
  "Promedio de goles": "Average goals", "Promedio de tarjetas": "Average cards", "Promedio de córners": "Average corners",
  "Promedio de tiros": "Average shots", "Promedio de TAP": "Average shots on target",
  "Media liga": "League avg", "Media de liga": "League average",
  "Estimaciones previas al partido; no hay probabilidades en directo. Son estimaciones estadísticas, no garantías.": "Pre-match estimates; there are no live probabilities. These are statistical estimates, not guarantees.",
  "Estimaciones previas al partido; no hay probabilidades en directo. Se ponderan más los partidos recientes y se separa el rendimiento en casa y fuera. Son estimaciones estadísticas, no garantías.": "Pre-match estimates; there are no live probabilities. Recent matches carry more weight and home/away performance is split. These are statistical estimates, not guarantees.",
  "Las tendencias recientes ponderan más los partidos nuevos. “Partido” usa el modelo de goles del encuentro.": "Recent trends give more weight to newer matches. “Match” uses the goal model for this fixture.",
  "Las columnas de equipo ponderan más los partidos recientes. El total del partido se estima con la producción de cada equipo y lo que concede el rival.": "Team columns give more weight to recent matches. The match total is estimated from each team's output and what the opponent concedes.",
  "Los tres picks más fuertes según los partidos previos, con más peso para la forma reciente y el rendimiento en casa o fuera.": "The three strongest picks from previous matches, with more weight on recent form and home/away performance.",
  "Rojo intenso: por encima de la media de la liga (±10%). Ámbar: similar. Rojo oscuro: por debajo. Sin media de liga disponible, el color indica solo si el porcentaje es alto (rojo intenso), medio (ámbar) o bajo (rojo oscuro).": "Bright red: above the league average (±10%). Amber: similar. Dark red: below. With no league average available, the colour only shows whether the percentage is high (bright red), medium (amber) or low (dark red).",
  "Goles esperados": "Expected goals", "Total esperado": "Expected total", "Tendencias de goles": "Goal trends",
  "Potencial de gol 1.er tiempo": "1st-half goal potential", "Potencial de gol 2.º tiempo": "2nd-half goal potential",
  "Ambos equipos marcan": "Both teams to score", "Total del partido": "Match total", "Métrica": "Metric", "Partido": "Match",
  "Tiros totales": "Total shots", "TAP": "Shots on target", "Córners": "Corners",
  "Media combinada de tiros": "Combined average shots", "Media combinada de TAP": "Combined average shots on target",
  "Media combinada de córners": "Combined average corners", "Total esperado de tarjetas": "Expected total cards",
  "Tendencias de TAP": "Shots on target trends", "Tendencias de córners": "Corner trends", "Tendencias de tarjetas": "Card trends",
  "Cómo se calcula": "How it's calculated", "Más de": "Over",
  // top 3 / stats / ligas
  "Los 3": "The 3", "mejores": "best", "Máximo": "Highest", "Más bajo": "Lowest",
  "Mejores coincidencias por valores promedio": "Best matches by average values",
  "Encuentra coincidencias con los valores promedio más altos o más bajos en cada métrica.": "Find matches with the highest or lowest average values for each metric.",
  "Disparos": "Shots", "Objetivos": "Goals",
  "Explora competiciones y encuentra partidos por liga.": "Explore competitions and find matches by league.",
  "Buscar liga o país": "Search league or country", "Todas las ligas": "All leagues", "ligas": "leagues",
  "Ver todas": "See all", "Ver menos": "See less", "Competiciones internacionales": "International competitions", "Sin resultados.": "No results.",
  // premium
  "PRÓXIMAMENTE": "COMING SOON", "Todos los datos del partido que necesitas, en un solo lugar.": "All the match data you need, in one place.",
  "Probabilidades de goles": "Goal probabilities", "Tiros y tiros a puerta": "Shots and shots on target",
  "Estadísticas de córners": "Corner stats", "Estadísticas de tarjetas": "Card stats", "Ver planes": "See plans",
  // auth
  "Crear cuenta": "Create account", "Regístrate": "Sign up", "Entrar": "Sign in",
  "Accede a tu cuenta con email y contraseña.": "Access your account with email and password.",
  "Crea tu cuenta con email y contraseña.": "Create your account with email and password.",
  "Recuperar contraseña": "Reset password", "Nueva contraseña": "New password",
  "Escribe tu email y te enviaremos un enlace para crear una contraseña nueva.": "Enter your email and we'll send you a link to create a new password.",
  "Elige una contraseña nueva para tu cuenta.": "Choose a new password for your account.",
  "Contraseña": "Password", "Repite la contraseña": "Repeat password", "¿Olvidaste tu contraseña?": "Forgot password?",
  "o continúa con": "or continue with", "Continuar con Google": "Continue with Google",
  "¿No tienes cuenta?": "Don't have an account?", "¿Ya tienes cuenta?": "Already have an account?",
  "Volver a iniciar sesión": "Back to sign in", "Enviar enlace": "Send link", "Guardar contraseña": "Save password", "Un momento…": "One moment…",
  "Privacidad": "Privacy", "Términos": "Terms", "Soporte": "Support",
  "Mostrar contraseña": "Show password", "Ocultar contraseña": "Hide password",
  "Email o contraseña incorrectos.": "Wrong email or password.",
  "Ese email ya tiene una cuenta. Inicia sesión.": "That email already has an account. Sign in.",
  "Confirma tu email antes de entrar (revisa tu bandeja y el spam).": "Confirm your email before signing in (check your inbox and spam).",
  "La contraseña debe tener al menos 6 caracteres.": "Password must be at least 6 characters.",
  "Las contraseñas no coinciden.": "Passwords don't match.",
  "Demasiados intentos. Espera unos minutos.": "Too many attempts. Wait a few minutes.",
  "La nueva contraseña debe ser distinta de la anterior.": "The new password must differ from the old one.",
  "Google aún no está activado en Supabase (ver README).": "Google is not enabled in Supabase yet (see README).",
  "Cuenta creada. Te enviamos un email para confirmarla: ábrelo y pulsa el enlace.": "Account created. We sent you an email to confirm it: open it and click the link.",
  "Si el email existe, recibirás un enlace para crear una contraseña nueva.": "If the email exists, you'll receive a link to create a new password.",
  "Mi cuenta ": "My account ",
};

export function translate(lang: LangCode, es: string): string {
  return lang === "en" ? EN[es] ?? es : es;
}
