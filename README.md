# PICKZONE · Análisis de fútbol

Web móvil‑first (Next.js 14 + Tailwind) para estudiar partidos: probabilidades estimadas, tendencias de goles, tiros, córners y tarjetas, Top 3 del día, ranking por métricas y catálogo de ligas.
Datos de fútbol de **ESPN** (sin clave) y caché en **Supabase**. Los CSV del repositorio se conservan, pero la aplicación ya no los carga como fuente ni como respaldo.

## Pantallas
Móvil: una columna con barra inferior. Escritorio (≥1024 px): menú superior, buscador de equipos y ligas, y dos columnas (lista de partidos + ficha) con scroll independiente.

Partidos (fecha, filtros con contadores, agrupado por liga, autorefresco en vivo) · Ficha (Análisis: General gratis / Goles / Tiros / Córners / Tarjetas Premium; estadísticas reales y alineaciones de ESPN cuando estén disponibles) · Los 3 mejores · Estadísticas (máximo / más bajo) · Ligas (buscador) · Buscador (`/buscar`) y página de equipo (`/equipo/ID`) · Suscripciones Premium con Stripe (`/premium`) · Registro, inicio de sesión (email y Google), recuperar contraseña y Mi cuenta · Estado (`/estado`).

## Probar en local (ESPN no necesita claves)
```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
```

## Despliegue paso a paso
1. **Supabase**: crea un proyecto → *SQL Editor* → pega y ejecuta `supabase/schema.sql`. En *Project Settings → API* copia la **URL** y la **service_role key**.
2. **GitHub**: sube esta carpeta a un repositorio.
3. **Vercel**: *Add New → Project* → importa el repo. En *Environment Variables* añade `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` (la misma URL) y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (la clave *anon / publishable* de Supabase), además de los opcionales de `.env.example`. ESPN funciona sin clave.
4. Abre `/estado` para comprobar la fuente ESPN y la configuración de Supabase. `USE_ESPN=false` desactiva ESPN; como los CSV ya no se cargan, no habrá datos de partidos mientras ESPN esté desactivado.

> Las claves solo se usan en servidor; nunca uses prefijo `NEXT_PUBLIC_`.

## Cuentas de usuario (registro, login, Google)
Ya incluido: `/registro`, `/login`, `/recuperar`, `/restablecer` y `/cuenta`. Usa Supabase Auth.

1. Ejecuta **todo** `supabase/schema.sql` (incluye la tabla `profiles` y sus políticas de seguridad).
2. En Vercel añade `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase → Project Settings → API → clave **anon/publishable**) y haz *Redeploy*.
3. Supabase → **Authentication → URL Configuration**:
   - *Site URL*: `https://TU-PROYECTO.vercel.app`
   - *Redirect URLs*: añade `https://TU-PROYECTO.vercel.app/auth/callback` (y `http://localhost:3000/auth/callback` para local).
4. **Email y contraseña** funciona ya. Por defecto Supabase exige confirmar el email; si quieres entrar sin confirmar (solo pruebas): Authentication → Providers → Email → desactiva *Confirm email*.
   El envío gratuito de emails de Supabase está limitado a pocos por hora; para producción configura un SMTP propio (Authentication → SMTP Settings).
5. **Google**:
   1. Google Cloud Console → *APIs & Services → Credentials → Create credentials → OAuth client ID* (tipo *Web application*). Si te lo pide, configura antes la pantalla de consentimiento.
   2. En *Authorized redirect URIs* pega la URL de callback que te muestra Supabase en Authentication → Providers → Google (`https://xxxx.supabase.co/auth/v1/callback`).
   3. Copia el *Client ID* y *Client Secret* en Supabase → Authentication → Providers → **Google** → activar → Guardar.

## Suscripciones Premium (Stripe)
- General del análisis permanece gratis. Goles, Tiros, Esquinas y Tarjetas del análisis requieren una suscripción activa; los usuarios sin suscripción ven una vista previa difuminada sin recibir los datos reales.
- Crea tres precios recurrentes en Stripe (semanal, mensual y anual) y configura en Vercel `STRIPE_PRICE_WEEKLY_ID`, `STRIPE_PRICE_MONTHLY_ID`, `STRIPE_PRICE_ANNUAL_ID`, `STRIPE_SECRET_KEY` y `SITE_URL`.
- Añade un webhook de Stripe a `https://TU-PROYECTO.vercel.app/api/billing/webhook` con los eventos `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated` y `customer.subscription.deleted`; guarda su secreto como `STRIPE_WEBHOOK_SECRET`.
- Activa el Customer Portal en Stripe para que cada usuario pueda gestionar o cancelar su suscripción desde `/premium`.
- Ejecuta de nuevo `supabase/schema.sql` para crear la tabla protegida `subscriptions`. Solo el servidor puede cambiar el estado; los cambios llegan desde el webhook firmado de Stripe.

## Perfil, ajustes e idioma
- El icono de usuario abre un menú: Iniciar sesión / Mi cuenta, **Ajustes**, Canal de Telegram (solo si defines `NEXT_PUBLIC_TELEGRAM_URL`), Ayuda y soporte y Colaboración.
- **Ajustes**: idioma (Español / English), tema (Oscuro / Claro) y zona horaria de los partidos (o la del dispositivo). Se guardan en cookies del navegador, sin necesidad de cuenta.
- Login centrado con ojo para ver la contraseña, “¿Olvidaste tu contraseña?”, Google y “Crear cuenta”.
- Defines tu email de contacto con `NEXT_PUBLIC_SUPPORT_EMAIL`. Las páginas de Privacidad y Términos son **texto provisional**: hazlas revisar antes de abrir la web al público.
- Traducción al inglés: navegación, menús, ajustes, acceso, filtros, pestañas y los títulos y etiquetas principales. Algunos textos largos y mensajes de la API siguen en español.
- **No incluido**: “Continuar con Telegram”. Supabase no lo trae de serie; requeriría crear un bot en @BotFather y un servicio propio de verificación.

## Fuente y cobertura
- ESPN es la única fuente de datos de fútbol para las nueve competiciones configuradas en `src/lib/espn.ts`: La Liga, Premier League, Serie A, Bundesliga, Ligue 1, Champions League, Europa League, Conference League y Supercopa de la UEFA. Los CSV se conservan en el repositorio, pero no se cargan en tiempo de ejecución.
- ESPN no requiere clave, pero las rutas públicas utilizadas no tienen un contrato de disponibilidad garantizado y podrían cambiar.
- En las competiciones UEFA, el calendario separa fase de liga y eliminatorias; las eliminatorias agrupan los partidos por enfrentamiento y muestran el global cuando hay ida y vuelta. La clasificación solo aparece en fase de liga. Si ESPN no identifica una fase, los partidos se agrupan por fecha sin inferir jornadas o rondas.
- Si ESPN no ofrece estadísticas de partido o no hay datos suficientes, se muestran guiones o avisos, no cifras inventadas.
- La clasificación se calcula con los resultados de la temporada. Las zonas oficiales de clasificación no se obtienen actualmente de ESPN.
- `FORM_MATCHES` (10 por defecto), `LEAGUE_IDS` y `MAX_ANALYSIS_FIXTURES` permiten ajustar el tamaño del análisis y las ligas consideradas.

## Cómo se calculan los datos (no se inventa nada)
- **Esperado por equipo** = media(lo que produce, lo que el rival concede) en sus últimos N partidos; total = suma.
- **Probabilidades** de más de 1,5/2,5, ambos marcan y 1X2: modelo de Poisson calculado a partir de los partidos disponibles.
- **Tendencias**: % de los últimos N partidos de cada equipo en que el total superó la línea; “Partido” promedia ambos.
- **Media de liga**: se calcula con los partidos disponibles de ESPN.
- **Los 3 mejores**: mayor probabilidad 1X2 entre los próximos partidos analizados. Estimación, no pick seguro.
- Sin datos suficientes se muestra “—” o un aviso.

## Personalizar
- Marca: `src/lib/config.ts` y `src/components/Logo.tsx`.
- Iconos: `src/components/icons.tsx` (un único archivo).
- Colores: `tailwind.config.ts`.
- Datos: `src/lib/espn.ts`, `src/lib/apifootball.ts` (fachada de datos ESPN) y `src/lib/metrics.ts`.

## Pendiente / decisiones tuyas
Estadísticas en vivo más allá del marcador y revisar las condiciones de uso de los datos de ESPN si publicas la web.

## Diferencias conscientes respecto a la referencia
- No hay bloqueos “Solo para suscriptores”: todas las estadísticas están visibles. El banner/página Premium es una maqueta (sin pagos) y se oculta con `SHOW_PREMIUM_BANNER=false`.
- En escritorio, `/` muestra “Selecciona un partido” en lugar de abrir uno por defecto, para no gastar cuota de API sin que lo pidas.
- Las tablas de tendencias usan el valor propio de cada equipo y “Total del partido” (muestra conjunta de ambos equipos), con líneas desde >2,5 (córners) y >0,5 (tarjetas), como en la referencia.
