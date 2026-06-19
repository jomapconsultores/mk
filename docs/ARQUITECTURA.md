# Arquitectura — Marketing MAP

## 1. Visión general

Sistema omnicanal con un **CRM central** como única fuente de verdad. Cada canal
(WhatsApp, Instagram, Facebook, Email, Web) es un "adaptador" que entrega y envía
mensajes, pero todos los contactos y conversaciones viven en la misma base de datos.

```
                 ┌─────────────────────────────────────────────┐
   Clientes ───► │  ADAPTADORES DE CANAL                        │
   (entran por)  │  WhatsApp · Instagram · Facebook · Email · Web│
                 └───────────────┬─────────────────────────────┘
                                 │  (webhooks entrantes)
                                 ▼
                 ┌─────────────────────────────────────────────┐
                 │  BACKEND (Node.js + TypeScript)              │
                 │  • Normaliza el mensaje                      │
                 │  • IA: clasifica el lead (Claude API)        │
                 │  • IA: genera respuesta / seguimiento        │
                 │  • Motor de secuencias (cron + colas)        │
                 │  • Reglas de baja (opt-out) y consentimiento │
                 └───────────────┬─────────────────────────────┘
                                 ▼
                 ┌─────────────────────────────────────────────┐
                 │  BASE DE DATOS (PostgreSQL / Supabase)       │
                 │  contacts · channel_identities · conversations│
                 │  messages · products · tags · sequences ...  │
                 └───────────────┬─────────────────────────────┘
                                 ▼
                 ┌─────────────────────────────────────────────┐
                 │  PANEL DE CONTROL (Next.js)                  │
                 │  Bandeja unificada · leads · reportes        │
                 └─────────────────────────────────────────────┘
```

## 2. Modelo de datos (resumen)

- **contacts** — el cliente (persona), independiente del canal.
- **channel_identities** — cómo se identifica ese cliente en cada canal (nº WhatsApp,
  IG id, email...). Un contacto puede tener varias. Así no se duplica el cliente.
- **conversations** / **messages** — hilo e historial completo por contacto.
- **products** — catálogo (negocio mixto: varios productos/servicios).
- **lead classification** — campos `stage`, `lead_score`, `interest_level`,
  `interested_product_id` en `contacts`, actualizados por IA.
- **tags** / **contact_tags** — etiquetado flexible.
- **consents** — registro de opt-in / opt-out por canal (cumplimiento legal). La baja
  es un hecho auditable, no solo un flag.
- **sequences** / **sequence_steps** / **sequence_enrollments** — seguimiento automático.
- **users** — el equipo (operadores/agentes).
- **events** — bitácora de todo lo que pasa (auditoría y métricas).

## 3. Clasificación de leads (cómo "piensa" la IA)

Cada mensaje entrante dispara una clasificación con Claude que devuelve:

- `stage`: `new` → `engaged` → `qualified` → `negotiating` → `customer` → `lost`
- `interest_level`: `low` | `medium` | `high`
- `interested_product_id`: qué producto le interesa (si se detecta)
- `lead_score`: 0–100 (probabilidad de compra)
- `intent`: p.ej. `pregunta_precio`, `quiere_comprar`, `pedir_baja`, `reclamo`...

Si `intent = pedir_baja` o el texto coincide con STOP/"baja"/"no me interesa", se
registra el opt-out y se detienen todas las secuencias para ese contacto.

## 4. Seguimiento automático (motor de secuencias)

Una **sequence** es una lista ordenada de pasos con esperas. Ejemplo "Lead nuevo sin responder":

1. Día 0: mensaje de bienvenida + pregunta.
2. Día 2 (si no respondió): recordatorio con beneficio.
3. Día 5 (si no respondió): oferta / descuento.
4. Día 8 (si no respondió): cierre suave + baja del flujo.

El motor corre cada cierto tiempo (cron), revisa `sequence_enrollments` pendientes,
respeta horarios y el opt-out, y envía por el canal correcto.

## 5. Cumplimiento legal (no opcional)

- **Opt-in** antes de enviar marketing (el cliente debe haber aceptado/escrito primero).
- **Opt-out** siempre disponible y respetado al instante.
- **WhatsApp**: usar plantillas aprobadas y la ventana de 24h de la Cloud API.
- **Datos personales**: guardar solo lo necesario; permitir borrado a pedido.

## 6. Hoja de ruta

### Fase 1 — MVP (vende solo)
- [x] Base de datos
- [ ] Webhook WhatsApp Cloud API (recibir/enviar)
- [ ] Clasificación de leads con Claude
- [ ] Auto-respuesta conversacional con Claude
- [ ] Opt-out automático
- [ ] Panel mínimo: bandeja + lista de leads

### Fase 2 — Omnicanal + seguimiento
- [ ] Adaptadores Instagram / Facebook / Email
- [x] Motor de secuencias de seguimiento (`src/sequences/engine.ts` + worker)
- [ ] Catálogo de productos en el panel
- [ ] Reportes básicos (leads por etapa, conversión)

### Fase 3 — Escala
- [ ] Captación: integración con Meta Ads / formularios / landing
- [ ] A/B testing de mensajes
- [ ] Reportes avanzados y alertas
- [ ] Roles y permisos del equipo

## 7. Variables de entorno (se definirán en el backend)

```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
ANTHROPIC_API_KEY=
WHATSAPP_TOKEN=
WHATSAPP_PHONE_ID=
WHATSAPP_VERIFY_TOKEN=
META_APP_SECRET=
```
