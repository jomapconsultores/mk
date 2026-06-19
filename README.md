# Marketing MAP — Sistema de Marketing y Ventas Automatizado

Sistema **omnicanal** de captación, clasificación y seguimiento automático de clientes.
Un mismo cliente, sin importar si llegó por WhatsApp, Instagram, Facebook, Email o la web.

> ⚠️ **Principio rector:** todo se hace con **APIs oficiales** y con **permiso del cliente
> (opt-in)**. No hacemos scraping ni mensajes en frío masivos: eso provoca baneos y es
> ilegal en muchos países. Captamos *atrayendo* (anuncios, contenido, chatbots) y
> automatizamos todo el seguimiento y la conversión.

---

## ¿Qué hace el sistema?

1. **Capta** leads desde cualquier canal (formularios, botón WhatsApp, DMs, chatbot web).
2. **Clasifica** cada contacto automáticamente con IA: etapa, interés, producto, score.
3. **Guarda** todo en un CRM central con historial completo.
4. **Responde y da seguimiento** solo, con secuencias automáticas y conversación con IA.
5. **Da de baja** automáticamente a quien lo pide (STOP / "no me interesa") — obligatorio por ley.
6. **Muestra todo** en un panel para que tú y tu equipo operen y vendan.

---

## Estructura del proyecto

```
Marketing_MAP/
├── README.md              ← este archivo
├── docs/
│   └── ARQUITECTURA.md     ← diseño técnico detallado y hoja de ruta
├── db/
│   └── schema.sql          ← base de datos completa (PostgreSQL / Supabase)
├── backend/                ← (siguiente fase) webhooks, IA, motor de automatización
└── dashboard/              ← (siguiente fase) panel de control Next.js
```

## Estado

- [x] Diseño de arquitectura
- [x] Base de datos omnicanal (CRM, clasificación, baja, secuencias) — **creada y desplegada en Supabase (proyecto pamplfrwwawfgvbzbndk, región us-east-2), con RLS activo**
- [x] Backend: webhook WhatsApp + clasificación IA + auto-respuesta + baja automática
- [x] Motor de secuencias de seguimiento (inscribe, respeta baja/horario, redacta con IA o plantilla)
- [x] Panel de control (Next.js): tablero, clientes, conversaciones, productos, seguimientos
- [x] Captación web: landing page + endpoint `/capture` (probado end-to-end con IA)
- [x] Preparado para despliegue en Render (`render.yaml` + guía + cron de seguimiento)
- [ ] Despliegue en vivo (subir a GitHub + aplicar blueprint) — ver [`docs/DESPLIEGUE_RENDER.md`](docs/DESPLIEGUE_RENDER.md)
- [ ] Integración Instagram / Facebook / Email / WhatsApp (Fase 2)
- [ ] Login del panel + roles (Fase 3)

> Estrategia Fase 1: **Metricool atrae** (contenido + anuncios) → **landing** captura → **CRM + IA**.
> Ver [`docs/METRICOOL_Y_LANDING.md`](docs/METRICOOL_Y_LANDING.md). WhatsApp queda para Fase 2.

> Para ponerlo a funcionar sigue [`docs/GUIA_INICIO.md`](docs/GUIA_INICIO.md).

Ver la hoja de ruta completa en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).
