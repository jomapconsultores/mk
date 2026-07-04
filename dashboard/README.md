# Panel de control — Marketing MAP

App web (Next.js) para que tú y tu equipo vean clientes, conversaciones, métricas,
y gestionen productos y seguimientos. Lee la base de datos **solo desde el servidor**
con la `service_role` (nunca expone llaves al navegador).

## Páginas

- `/` **Tablero**: KPIs (clientes, nuevos hoy, ganados, mensajes, bajas) y embudo por etapa.
- `/leads` **Clientes**: lista ordenada por score, con filtros por etapa.
- `/leads/[id]` **Detalle**: datos, resumen IA, actividad, conversación completa y botón de baja.
- `/products` **Productos**: alta/edición del catálogo que usa la IA para vender.
- `/sequences` **Seguimientos**: secuencias automáticas y cuántos clientes hay en curso.

## Correr en local

```bash
cd dashboard
cp .env.example .env.local     # Windows: copy .env.example .env.local
# edita .env.local con tus valores reales
npm install
npm run dev
```

Abre http://localhost:3001

## Variables de entorno

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | URL pública del backend — se incrusta en el bundle en build-time |
| `BACKEND_URL` | URL del backend — usada en runtime, server-side |
| `SUPABASE_URL` | URL de tu proyecto Supabase |
| `SUPABASE_SERVICE_KEY` | service_role (secreta, solo servidor) |
| `DASHBOARD_PASSWORD` | Clave de acceso al panel (login con contraseña) |
| `SESSION_SECRET` | Cadena aleatoria larga para firmar la cookie de sesión |
| `WEBAUTHN_RP_ID` | Dominio del dashboard sin protocolo (ej. `panel.tudominio.com`) |
| `WEBAUTHN_ORIGIN` | Origen completo con protocolo (ej. `https://panel.tudominio.com`) |

## Login

El panel tiene login con contraseña (`/login`) y biometría/passkeys vía WebAuthn
(huella o rostro, según el dispositivo). `WEBAUTHN_RP_ID` y `WEBAUTHN_ORIGIN` deben
coincidir con el dominio real donde esté publicado el panel — si no, la biometría no
va a funcionar.
