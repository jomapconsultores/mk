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
# edita .env.local con SUPABASE_URL y SUPABASE_SERVICE_KEY
npm install
npm run dev
```

Abre http://localhost:3001

## Variables de entorno

| Variable | Para qué |
|---|---|
| `SUPABASE_URL` | URL de tu proyecto Supabase |
| `SUPABASE_SERVICE_KEY` | service_role (secreta, solo servidor) |
| `DASHBOARD_PASSWORD` | (futuro) clave de acceso al panel |

> ⚠️ Pendiente Fase 3: login con contraseña/roles. Hoy el panel asume red privada.
> No lo publiques en internet abierto sin agregar autenticación.
