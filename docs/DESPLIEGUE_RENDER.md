# Despliegue en Render (paso a paso)

Publica el sistema 24/7 en Render (plan gratis). Ya está todo preparado: `render.yaml`
crea los 3 servicios automáticamente. El código ya está en un commit de Git local.

---

## Paso 1 — Subir el código a GitHub

1. Crea una cuenta en [github.com](https://github.com) (si no tienes) y crea un repositorio
   **vacío** (sin README), por ejemplo `marketing-map`. Cópialo en privado.
2. En tu terminal, dentro de `C:\Users\mapos\Dropbox\Programas\Marketing_MAP`, conecta y sube:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/marketing-map.git
   git push -u origin main
   ```
   > Te pedirá iniciar sesión en GitHub (se abre el navegador). Acepta.
   > 💡 Puedes ejecutar estos comandos aquí mismo escribiendo `! git push -u origin main`.

## Paso 2 — Rotar las llaves (SEGURIDAD — hazlo ahora)

Como compartiste varias llaves en el chat, **genera nuevas antes de desplegar** y usa
las nuevas en Render:
- **Supabase service_role:** Supabase → Project Settings → API → regenera la `service_role`.
- **Contraseña de la base de datos:** Settings → Database → Reset password (no la usa la app,
  pero conviene rotarla porque la compartiste).
- **Anthropic:** [console.anthropic.com](https://console.anthropic.com) → borra la llave vieja y crea una nueva.
- **API key de Render:** Account Settings → API Keys → borra la `rnd_...` vieja.
- **Inventa un `CRON_SECRET`:** una cadena larga al azar (p.ej. 32 caracteres).

## Paso 3 — Crear los servicios en Render

1. Entra a [dashboard.render.com](https://dashboard.render.com).
2. **New + → Blueprint**.
3. Conecta tu cuenta de GitHub y elige el repo `marketing-map`.
4. Render detecta `render.yaml` y te muestra los 3 servicios:
   `marketing-map-backend`, `marketing-map-dashboard`, `marketing-map-landing`.
5. Antes de crear, te pedirá las variables marcadas como secretas. Pégalas (las **nuevas**):

   **Backend** (`marketing-map-backend`):
   | Variable | Valor |
   |---|---|
   | `SUPABASE_SERVICE_KEY` | tu service_role **nueva** |
   | `ANTHROPIC_API_KEY` | tu llave Anthropic **nueva** |
   | `CRON_SECRET` | la cadena al azar que inventaste |
   | `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_ID` / `WHATSAPP_VERIFY_TOKEN` | déjalas vacías por ahora (Fase 2) |

   **Panel** (`marketing-map-dashboard`):
   | Variable | Valor |
   |---|---|
   | `SUPABASE_SERVICE_KEY` | la misma service_role nueva |

6. Dale **Apply**. Render construye y publica. Te dará 3 URLs, por ejemplo:
   - Backend:  `https://marketing-map-backend.onrender.com`
   - Panel:    `https://marketing-map-dashboard.onrender.com`
   - Landing:  `https://marketing-map-landing.onrender.com`

## Paso 4 — Apuntar la landing al backend

1. Edita `landing/index.html`, línea del `BACKEND_URL`:
   ```js
   const BACKEND_URL = "https://marketing-map-backend.onrender.com";
   ```
2. Guarda, haz commit y push:
   ```bash
   git add landing/index.html && git commit -m "Landing apunta al backend de produccion" && git push
   ```
   Render reconstruye la landing sola. ¡Ya captura leads reales!

## Paso 5 — Activar el motor de seguimiento (cron gratis)

1. Crea una cuenta gratis en [cron-job.org](https://cron-job.org).
2. Nuevo cronjob:
   - **URL:** `https://marketing-map-backend.onrender.com/cron/run-sequences`
   - **Método:** POST
   - **Cabecera:** `x-cron-secret: <tu CRON_SECRET>`
   - **Frecuencia:** cada 10 minutos.
3. Guarda. Esto dispara los seguimientos y mantiene el backend despierto.

## Paso 6 — Probar en producción

- Abre la URL de la **landing** y envía un formulario de prueba.
- Abre el **panel** y míralo aparecer clasificado en "Clientes".
- (Borra los leads de prueba cuando quieras desde el panel.)

---

## Notas

- **Plan free de Render:** los servicios web se "duermen" tras 15 min sin uso y tardan
  ~50s en despertar. El cron del Paso 5 los mantiene despiertos. Para algo serio,
  el plan Starter de Render (~7 USD/mes por servicio) evita el "sueño".
- **Seguridad del panel:** hoy no tiene login. No compartas su URL públicamente hasta
  agregar autenticación (Fase 3). Para uso interno del equipo, comparte el enlace solo
  con ellos.
- **WhatsApp (Fase 2):** cuando tengas la app de Meta, rellenas las 3 variables de WhatsApp
  en el backend y configuras el webhook a `https://marketing-map-backend.onrender.com/webhooks/whatsapp`.
