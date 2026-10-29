# PICKZONE · Análisis de fútbol

Web móvil‑first (Next.js 14 + Tailwind) para estudiar partidos: probabilidades estimadas, tendencias de goles, tiros, córners y tarjetas, Top 3 del día, ranking por métricas y catálogo de ligas.
Datos de **API‑Football** (solo servidor) y caché en **Supabase**. Marca, textos y código propios (inspirada en la organización de Oddster, sin reutilizar sus recursos).

## Pantallas
Móvil: una columna con barra inferior. Escritorio (≥1024 px): menú superior, buscador de equipos y ligas, y dos columnas (lista de partidos + ficha) con scroll independiente.

Partidos (fecha, filtros con contadores, agrupado por liga, autorefresco en vivo) · Ficha (General gratis / Goles / Tiros / Córners / Tarjetas Premium) · Los 3 mejores · Estadísticas (máximo / más bajo) · Ligas (buscador) · Buscador (`/buscar`) y página de equipo (`/equipo/ID`) · Suscripciones Premium con Stripe (`/premium`) · Registro, inicio de sesión (email y Google), recuperar contraseña y Mi cuenta · Estado (`/estado`).

## Probar en local (sin claves = modo DEMO)
```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
```

## Despliegue paso a paso
1. **Supabase**: crea un proyecto → *SQL Editor* → pega y ejecuta `supabase/schema.sql`. En *Project Settings → API* copia la **URL** y la **service_role key**.
2. **API‑Football**: crea cuenta en dashboard.api-football.com y copia tu API key (acceso directo, cabecera `x-apisports-key`).
3. **GitHub**: sube esta carpeta a un repositorio.
4. **Vercel**: *Add New → Project* → importa el repo. En *Environment Variables* añade `API_FOOTBALL_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` (la misma URL) y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (la clave *anon / publishable* de Supabase) (y los opcionales de `.env.example`). *Deploy*.
5. Abre `/estado` en tu web: debe mostrar API‑Football y Supabase como “Conectada”.

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
- General del partido permanece gratis. Goles, Tiros, Esquinas y Tarjetas requieren una suscripción activa; los usuarios sin suscripción ven una vista previa difuminada sin recibir los datos reales.
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

## Cuota de API (importante)
- Plan gratis: 100 solicitudes/día y 10/min. Usa `API_MIN_INTERVAL_MS=6500`, `FORM_MATCHES=3`, `LEAGUE_IDS=<una liga>` (p. ej. `140` La Liga) y `MAX_ANALYSIS_FIXTURES=4`.
- Caché: listado de hoy 90 s · otros días 15 min · partido en vivo 45 s · terminado 30 días · estadísticas de partidos terminados **para siempre** (tabla `fixture_stats`) · ligas 24 h · predicciones 12 h.
- Si quedan menos de `QUOTA_RESERVE` solicitudes, solo se hacen llamadas esenciales (listado y ficha) y se sirven datos en caché.
- Tiros/Córners/Tarjetas gastan llamadas la primera vez (1 + N por equipo); después quedan guardadas.
- Vercel Hobby limita las funciones a 60 s: con plan gratis de API y pausa de 6,5 s, la primera carga de un partido puede tardar.

## Limitación del plan gratuito de API‑Football
El plan gratuito solo da acceso a las temporadas 2022–2024 en las consultas por temporada. Con él funcionan: listado de partidos del día, ficha, 1X2 y consejo de la predicción, y goles estimados (con las medias de los últimos 5 partidos que devuelve la predicción). **No** se pueden calcular promedios de tiros, tiros a puerta, córners y tarjetas, ni medias de liga, porque requieren la temporada actual. Con un plan de pago (ver precios vigentes en api-football.com/pricing) se activan solos, sin cambiar el código. La app recuerda el bloqueo 6 h para no gastar cuota.

## Cómo se calculan los datos (no se inventa nada)
- **Esperado por equipo** = media(lo que produce, lo que el rival concede) en sus últimos N partidos; total = suma.
- **Probabilidades** de más de 1,5/2,5 y ambos marcan: modelo de Poisson. **1X2**: predicciones de API‑Football si existen; si no, Poisson.
- **Tendencias**: % de los últimos N partidos de cada equipo en que el total superó la línea; “Partido” promedia ambos.
- **Media de liga**: goles desde la clasificación; resto desde los partidos ya guardados en Supabase (solo con ≥ `MIN_LEAGUE_SAMPLE`). Colores ±10%.
- **Los 3 mejores**: mayor probabilidad 1X2 entre los próximos partidos analizados. Estimación, no pick seguro.
- Sin datos suficientes se muestra “—” o un aviso.

## Personalizar
- Marca: `src/lib/config.ts` y `src/components/Logo.tsx`.
- Iconos: `src/components/icons.tsx` (un único archivo).
- Colores: `tailwind.config.ts`.
- Datos: `src/lib/apifootball.ts`, `src/lib/metrics.ts`.

## Pendiente / decisiones tuyas
Autenticación y planes premium (no incluidos), banner promocional, estadísticas en vivo más allá del marcador, y revisar los términos de API‑Football si publicas la web.

## Diferencias conscientes respecto a la referencia
- No hay bloqueos “Solo para suscriptores”: todas las estadísticas están visibles. El banner/página Premium es una maqueta (sin pagos) y se oculta con `SHOW_PREMIUM_BANNER=false`.
- En escritorio, `/` muestra “Selecciona un partido” en lugar de abrir uno por defecto, para no gastar cuota de API sin que lo pidas.
- Las tablas de tendencias usan el valor propio de cada equipo y “Total del partido” (muestra conjunta de ambos equipos), con líneas desde >2,5 (córners) y >0,5 (tarjetas), como en la referencia.
