# Despliegue en Coolify — Marketing MAP

Migración desde Render. Se despliegan **3 aplicaciones** (la base de datos sigue en **Supabase**, externa).

| App | Carpeta (Base Directory) | Tipo en Coolify | Puerto interno |
|-----|--------------------------|-----------------|----------------|
| Backend (API) | `backend` | Dockerfile | 3000 |
| Dashboard (panel) | `dashboard` | Dockerfile | 3000 |
| Landing (estática) | `landing` | Dockerfile (nginx) | 80 |

Cada carpeta ya tiene su `Dockerfile` y `.dockerignore`. En Coolify, al crear cada recurso elige
**Build Pack = Dockerfile** y configura el **Base Directory** correspondiente.

---

## 1) Backend — variables de entorno

Coolify inyecta `PORT` automáticamente; el server lo lee en `config.ts`.

| Variable | Obligatoria | Notas |
|----------|:-:|-------|
| `SUPABASE_URL` | ✅ | `https://pamplfrwwawfgvbzbndk.supabase.co` |
| `SUPABASE_SERVICE_KEY` | ✅ 🔒 | Service role key de Supabase |
| `ANTHROPIC_API_KEY` | ✅ 🔒 | |
| `ANTHROPIC_MODEL` | ⬜ | Default `claude-sonnet-4-6` |
| `MISTRAL_API_KEY` | ⬜ 🔒 | IA preferida (1ª opción) |
| `CODESTRAL_API_KEY` | ⬜ 🔒 | |
| `MISTRAL_MODEL` | ⬜ | Default `mistral-small-latest` |
| `CODESTRAL_MODEL` | ⬜ | Default `codestral-latest` |
| `DEEPSEEK_API_KEY` | ⬜ 🔒 | IA 2ª opción |
| `DEEPSEEK_MODEL` | ⬜ | Default `deepseek-chat` |
| `WHATSAPP_TOKEN` | ⬜ 🔒 | |
| `WHATSAPP_PHONE_ID` | ⬜ | |
| `WHATSAPP_VERIFY_TOKEN` | ⬜ 🔒 | Verificación del webhook de Meta |
| `RESEND_API_KEY` | ⬜ 🔒 | Email outreach |
| `RESEND_FROM_EMAIL` | ⬜ | Remitente verificado |
| `GOOGLE_PLACES_API_KEY` | ⬜ 🔒 | Scraping de negocios |
| `CRON_SECRET` | ✅ 🔒 | Protege `POST /cron/run-sequences` |

**Healthcheck:** `GET /health` (ya configurado en el Dockerfile y disponible en Coolify).

---

## 2) Dashboard — variables de entorno

⚠️ El dashboard necesita **más variables que en Render**. Una es de **build-time**.

| Variable | Obligatoria | Cuándo | Notas |
|----------|:-:|--------|-------|
| `NEXT_PUBLIC_BACKEND_URL` | ✅ | **BUILD** | Se incrusta en el bundle. En Coolify márcala como **Build Variable**. URL pública del backend. |
| `BACKEND_URL` | ✅ | runtime | URL del backend (server-side) |
| `SUPABASE_URL` | ✅ | runtime | |
| `SUPABASE_SERVICE_KEY` | ✅ 🔒 | runtime | |
| `SESSION_SECRET` | ✅ 🔒 | runtime | Cadena aleatoria larga (firma de sesión) |
| `DASHBOARD_PASSWORD` | ✅ 🔒 | runtime | Contraseña de acceso al panel |
| `WEBAUTHN_RP_ID` | ✅ | runtime | Dominio del dashboard, ej. `panel.tudominio.com` (sin `https://`) |
| `WEBAUTHN_ORIGIN` | ✅ | runtime | Origen completo, ej. `https://panel.tudominio.com` |

> En Coolify, las variables marcadas como **Build Variable** se pasan al `docker build`
> (el `ARG NEXT_PUBLIC_BACKEND_URL` del Dockerfile). Las demás son de runtime.

---

## 3) Landing — sin variables

Sitio estático servido por nginx en el puerto 80. Solo asigna el dominio.

---

## 4) Cron del motor de seguimiento

En Render se usaba un cron externo (cron-job.org) que llamaba cada 10 min a
`POST /cron/run-sequences` con la cabecera `x-cron-secret: <CRON_SECRET>`.

En Coolify usa **Scheduled Tasks** (sobre el recurso del backend) o mantén el cron externo:

```
*/10 * * * *   curl -fsS -X POST http://<backend-interno>:3000/cron/run-sequences \
                 -H "x-cron-secret: $CRON_SECRET"
```

---

## 5) Tras desplegar — actualizar URLs cruzadas

- `backend/src/server.ts` lee `DASHBOARD_URL` y `LANDING_URL` (opcionales) para los enlaces
  de su página raíz informativa. Configúralas con los dominios finales de Coolify.
- Reapunta el webhook de WhatsApp/Meta a la nueva URL del backend.
- Actualiza `NEXT_PUBLIC_BACKEND_URL` / `BACKEND_URL` del dashboard a la URL final del backend.

---

## 6) Limpieza

- 🔑 **Rota el API token de Coolify** que se usó para automatizar el despliegue.
