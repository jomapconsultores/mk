# Marketing MAP — Informe ejecutivo de auditoría del embudo

## 1. Cómo funciona hoy el embudo

1. **Entrada WhatsApp**: Meta llama a `POST /webhooks/whatsapp` (`backend/src/server.ts:224`), el servidor responde 200 de inmediato y procesa en segundo plano, con dedupe en un `Map` en memoria.
2. `handleInboundMessage` (`backend/src/orchestrator.ts:69`) crea/recupera el contacto, clasifica el mensaje con IA, lo guarda, aplica la clasificación al CRM (stage / lead_score / ai_summary), detecta baja legal, genera perfil psicológico y respuesta, y contesta por WhatsApp.
3. **Entrada web**: el formulario de `landing/index.html` llama a `POST /capture` → `handleWebLead` (`orchestrator.ts:180`), que crea el contacto con canal `web`, clasifica y **termina en `return { contactId }` sin enviar nada** (verificado).
4. **Seguimiento**: un worker cada 5 min inscribe contactos que cumplen el trigger de la secuencia (`sequences/engine.ts:60`) y procesa los enrollments vencidos (`engine.ts:97`), con cadencia sembrada +24h/+72h/+96h/+120h y horas de silencio 21–09.
5. **Prospección en frío**: scraping de Google Maps → calificación IA → campañas de outreach por email/WhatsApp (`backend/src/prospecting/*`).
6. **Panel**: Next.js con /leads, /ventas (Kanban), /sequences, /prospeccion, /pedidos, /tendencias. Todas las vistas son de **lectura**; el vendedor no puede responder desde el panel.
7. El único canal de salida realmente implementado es WhatsApp texto libre: `sendByChannel` hace `console.warn` para todo lo demás (`backend/src/channels/send.ts:13-14`, verificado).

**Resumen honesto**: el sistema captura y clasifica bien. **No entrega**: no responde al lead web, no persigue con secuencias, no permite actuar desde el panel y no mide ingresos.

---

## 2. Los problemas que más ventas cuestan

Agrupados por problema de negocio, ordenados por (impacto ÷ esfuerzo).

### P1. El motor de seguimiento no envía nada, y encima miente diciendo que sí
*Hallazgos 1, 24, 25, 31, 26, 7*

Tres fallos encadenados en `backend/src/sequences/engine.ts`:

- **Se autocancela antes del paso 1**: `const since = lastOut?.created_at ?? new Date(0).toISOString()` (línea 170, verificado). Si el contacto nunca recibió un outbound, la referencia es 1970, `hasInboundSince` devuelve `true` porque el propio mensaje que creó el lead es inbound, y el enrollment pasa a `completed` **sin enviar un solo mensaje**. Los 4 pasos sembrados llevan `no_reply_since_last_step: true` (`db/seed_sequences.sql:25,29,33,37`). Afecta al **100% de los leads web**.
- **Si sobreviviera, Meta lo rechaza**: los pasos 2-4 (+72h/+96h/+120h) caen siempre fuera de la ventana de servicio de 24h y `sendWhatsAppText` solo manda `type:'text'` free-form. No existe ninguna referencia a plantillas en el backend. Error 131047 garantizado.
- **Y el error mata la inscripción para siempre**: el catch marca `status:'failed'` ante cualquier excepción (línea 110, verificado). No hay `attempts`, ni backoff, ni requeue, y el `unique(sequence_id, contact_id)` de `db/schema.sql:254` impide reinscribir. El panel `/sequences` solo cuenta `active`, así que nadie lo ve.

**Coste**: cero seguimiento automático. Se paga IA de clasificación por leads que después se abandonan en silencio.

### P2. El lead de la landing entra y se queda mudo
*Hallazgos 2, 9, 16, 8*

`handleWebLead` no llama a `generateReply` ni a `sendByChannel` (verificado). Además crea identidad `channel:'web'` mientras la secuencia sembrada es `channel:'whatsapp'`, así que `getChannelIdentity` devuelve `null` y el enrollment se marca `completed` (`engine.ts:191`, verificado). Y aunque el canal coincidiera, `sendByChannel` solo implementa WhatsApp.

En el mejor caso el primer contacto tarda 24h; en el real, **nunca llega**. Encima `/capture` espera a la clasificación LLM sin timeout antes de responder, y si tarda el navegador cae en el `catch` que muestra "Hubo un problema al enviar" — con el contacto ya creado y el usuario convencido de que no se envió, sin reintento ni persistencia local.

**Coste**: es la fuga más cara. Todo el gasto en tráfico hacia la landing se desperdicia en el minuto uno.

### P3. Un fallo de IA corrompe el CRM en silencio
*Hallazgos 5, 17, 18, 20, 23*

- `classifyMessage` se llama **sin historial** (`orchestrator.ts:93`, verificado), aunque el mismo `Promise.all` ya calcula `history` para `generateReply` y el prompt lo espera. Un cliente en `negotiating` que escribe "ok" o "gracias" se reclasifica como `new` / `low`.
- El fallback de error de `classify.ts:44-52` (`stage:'new'`, `lead_score:0`, `summary:''`) se persiste como si fuera clasificación real. `rescore.ts:19` protege explícitamente contra esto en la ruta manual; la ruta automática —que corre miles de veces más— no.
- `applyClassification` (`repo.ts:134`) hace UPDATE absoluto, sin validar el enum ni revisar el `error` de Supabase: un valor inventado por el LLM falla en silencio.
- Sin `temperature: 0` ni `response_format: json_object` (`router.ts:52-59`), el mismo mensaje da scores distintos: el `lead_score` que ordena la lista del vendedor es ruido parcialmente aleatorio.

**Coste**: una caída de 10 min de los proveedores degrada a `new`/score 0 a todos los clientes que escriban, incluidos los ya cerrados, y borra sus resúmenes. Irreversible.

### P4. Ninguna llamada externa tiene timeout ni fallback
*Hallazgos 10, 11, 22, 6, 14*

`callOpenAICompat` (`router.ts:46`), `callClaude` (`router.ts:78`) y `sendWhatsAppText` (`whatsapp.ts:12`) no pasan `AbortSignal`. Si Mistral acepta la conexión y no contesta, **la cadena de fallback multi-proveedor nunca se activa**: el `await` se queda colgado. `generateReply` no tiene try/catch; la excepción sube al catch del webhook, que solo loguea. El `messageId` ya está marcado como visto y a Meta ya se le respondió 200, así que el mensaje del cliente **desaparece para siempre**. El bucle `for` está dentro del try: un fallo en el primer mensaje aborta todo el batch.

### P5. La escalada a humano y el traspaso IA→vendedor son código muerto
*Hallazgos 3, 15, 52, 53, 4, 51*

- `needs_human` se escribe en `orchestrator.ts:165` y se le promete al cliente "en un momento te escriben". **Ninguna vista del dashboard lo selecciona**. La bandera se enciende y se queda encendida.
- `toggleAutopilot` escribe `conversations.ai_autopilot` y **no lo importa nadie**; el backend nunca lee la columna. Si un vendedor toma una negociación, el bot sigue contestando en paralelo y puede pisar el precio negociado.
- La conversación en `/leads/[id]` es solo lectura: no hay input, ni server action, ni ruta de envío en el backend. El vendedor sale a WhatsApp Web, responde fuera del sistema, y esa respuesta nunca entra en `messages` — rompiendo el scoring y reactivando las secuencias encima de una conversación humana.

### P6. Los mensajes que no son texto se tiran a la basura
*Hallazgo 13*

`parseWhatsAppWebhook` filtra con `if (msg.type === 'text')` (`whatsapp.ts:53`). Notas de voz, fotos, documentos, ubicaciones y respuestas a botones se descartan **antes** de crear el contacto: no se guarda nada, no aparece en `/leads`, ninguna secuencia lo alcanza. En Ecuador la nota de voz es un modo de primer contacto habitual y la foto de producto es intención de compra clarísima.

### P7. La medición no permite decidir dónde invertir
*Hallazgos 45, 46, 47, 48, 49, 50*

- `confirmOrder` (`pedidos/actions.ts:186`) solo cambia `orders.status`: no mueve `contacts.stage`, no escribe evento. `/tendencias` **nunca consulta `orders`**. Se puede facturar $5.000 y el tablero no muestra un dólar.
- Cero captura de UTM/gclid/fbclid: todos los leads de pago llegan indistinguibles como "Web / Landing". No hay CPL ni ROAS posible.
- `contacts` no tiene `stage_changed_at`: no se puede calcular tasa etapa→etapa ni velocidad del embudo. Ironía: la tabla `prospects` del embudo outbound **sí** tiene `qualified_at/responded_at/converted_at`.
- `/tendencias` trae 5.000 filas sin `order by` y agrega en JavaScript: al superar ese umbral el tablero **empieza a mentir sin aviso**.

### P8. Riesgo de perder el número de WhatsApp y el dominio de correo
*Hallazgos 32, 41, 33, 34, 35, 36, 30*

- La prospección en frío manda WhatsApp de texto libre a números que nunca escribieron (`prospecting/engine.ts:257`), sin opt-in registrado. O no se entrega nada, o el volumen de reportes hunde el quality rating y **banean el número que también atiende el inbound del CRM**.
- Los teléfonos de Google Maps se guardan en formato nacional (`nationalPhoneNumber`) y se envían tal cual a la Cloud API: ningún envío puede salir, y cuando un prospecto responde, `convertProspectToContact` nunca lo encuentra por igualdad exacta contra el E.164 de Meta. La atribución de todo el outbound queda en cero.
- El email en frío sale sin `List-Unsubscribe`, sin enlace de baja, sin dirección física, y con el prompt ordenando "no menciones tu empresa" (`writer.ts:49`). Va a spam desde el primer día.
- Cero visibilidad: se ignoran los `statuses` del webhook (sent/delivered/read/failed) y `outreach_messages` se inserta siempre como `'sent'`. Los KPIs cuentan mensajes que nunca llegaron.
- `nextBusinessTime` reprograma todo a las **09:00:00.000 exactas**, sin jitter: ráfaga matinal idéntica, el patrón que los antispam de Meta detectan.

### P9. Exposición legal LOPDP documentada por escrito
*Hallazgos 38, 39, 40, 42, 43, 37, 44*

- El checkbox de consentimiento de la landing **no viaja en la petición**: el submit envía solo `{name, phone, email, message}`. `consents` queda registrado como `'inbound_message'` cuando el esquema prevé `'web_form'`. Sin timestamp, IP, ni versión de política. Ante una auditoría no hay evidencia.
- `landing/politica.html` §4 declara base legal **consentimiento**, mientras `captacion/search.ts:474-478` escribe `interes_legitimo_comercial` + `google_maps_listado_publico` en cada prospecto scrapeado. Y `README.md:6-9` afirma "no hacemos scraping ni mensajes en frío masivos". Contradicción trivialmente demostrable.
- Los `prospects` no tienen columna de opt-out y no se cruzan con quienes ya pidieron baja en el CRM: un cliente que pidió la baja puede volver a entrar por Google Maps como prospecto nuevo.
- El flag `lopdp_opt_out` que se escribe en `raw_data` **no se lee en ninguna parte**.
- Sin política de retención ni borrado: `deleteContact` borra en cascada y destruye justo la evidencia de consentimiento que hay que conservar.

### P10. El panel no deja trabajar
*Hallazgos 55, 57, 56, 54*

`/leads` es un `.order('lead_score').limit(200)` sin buscador ni paginación: cuando un cliente llama, si no está entre los 200 de mayor score **no se puede encontrar**. Y los que llaman de vuelta son precisamente los de score bajo. `/prospeccion` es una tabla muerta: sin ficha, sin descartar, sin marcar respondido. Ningún teléfono o email es clicable (`wa.me|tel:|mailto:` no aparece ni una vez en todo `dashboard/src`). "Prioridad IA" es un score congelado que ignora la recencia.

### P11. Bombas de tiempo silenciosas
*Hallazgos 27, 28*

- `enrollEligibleContacts` consulta `.limit(500)` **sin order by y sin excluir a los ya inscritos**: al superar 500 contactos en `stage='new'` —cuestión de meses— los leads nuevos dejan de inscribirse. Sin error, sin log.
- Dos disparadores simultáneos (worker con `setInterval` sin guardia + `POST /cron/run-sequences`) sin claim de filas ni idempotencia: el cliente puede recibir el mismo mensaje dos o tres veces seguidas.

---

## 3. Plan de acción

### 🌊 Ola 1 — Quick wins (horas, alto retorno)

| # | Acción | Archivos | Hecho cuando |
|---|---|---|---|
| 1.1 | Desactivar WhatsApp como canal de primer toque en frío | `backend/src/prospecting/engine.ts:159-162`, `db/add_prospecting.sql:90,170` (+ `update outreach_campaigns set channel_order = array_remove(...)`) | Ninguna campaña puede enviar WhatsApp a un prospecto sin `responded_at`; guard explícito en `sendViaChannel` que lanza error tipificado |
| 1.2 | Timeouts en todas las llamadas externas | `ai/router.ts:46` (`AbortSignal.timeout(8000)`), `router.ts:75` (`new Anthropic({timeout:8000, maxRetries:1})`), `channels/whatsapp.ts:12` (10000) | Un proveedor colgado hace saltar el fallback en <10s; presupuesto total de 15s en el bucle `CHAIN` |
| 1.3 | try/catch dentro del bucle del webhook + no marcar visto antes del éxito | `backend/src/server.ts:237-254` | Un mensaje fallido no cancela los demás del batch; `seenMessageIds.delete(id)` en el catch |
| 1.4 | Pasar `history` y `currentStage` al clasificador | `orchestrator.ts:91-95` y `:205-206` | `classifyMessage` recibe historial en ambas rutas; un "ok" de un contacto en `negotiating` no lo baja a `new` |
| 1.5 | `applyClassification` no destructiva | `backend/src/repo.ts:131-148` | No sobrescribe `ai_summary` vacío, no degrada desde `customer/negotiating/lost`, valida enum con whitelist, comprueba `error` de Supabase |
| 1.6 | `no_reply_since_last_step` neutra sin outbound previo | `sequences/engine.ts:161-175` | Sin outbound previo el paso 1 **se envía**; el corte por respuesta usa `status:'stopped'`, no `'completed'` |
| 1.7 | `temperature: 0` + `response_format: json_object` en tareas classify/sequence | `ai/router.ts:52-59`, `:78-83` | Dos clasificaciones del mismo texto dan el mismo resultado |
| 1.8 | `needs_human` visible en el panel | `dashboard/src/app/leads/page.tsx:16`, `ventas/page.tsx:19`, `leads/[id]/page.tsx` | Badge rojo + chip de filtro `?needs_human=1` + botón "Atendido" que lo apaga |
| 1.9 | Enlaces accionables `wa.me` / `tel:` / `mailto:` | `dashboard/src/lib/format.ts` (nuevos `e164()` y `waDigits()`), `leads/[id]/page.tsx:82-85`, `prospeccion/page.tsx:236-237` | Un clic abre el chat; si el helper devuelve `null`, se pinta texto plano en vez de enlace roto |
| 1.10 | `.order('created_at', desc)` en las consultas de `/tendencias` | `dashboard/src/app/tendencias/page.tsx:44-49` | El recorte de 5.000 es determinista y realmente reciente |
| 1.11 | Buscador en `/leads` | `dashboard/src/app/leads/page.tsx` (patrón de `pedidos/actions.ts:32-43`) | `.or()` sobre `full_name/display_name/phone/email`, con `q` saneado de `,` y `%` |
| 1.12 | Fallback de la landing si falla el POST | `landing/index.html:741-778` | Payload en `localStorage` antes del fetch, purga al cargar, y bloque con `wa.me` + `mailto:` prellenados en vez del `alert` |

### 🌊 Ola 2 — Una semana

| # | Acción | Archivos | Hecho cuando |
|---|---|---|---|
| 2.1 | **Acuse inmediato al lead web** | `orchestrator.ts:180-225`, `channels/send.ts:8-16`, `channels/email.ts` | Con teléfono: identidad `whatsapp` en E.164 + `generateReply` + `sendByChannel` + `saveMessage`. Sin teléfono: `case 'email'` cableado a `sendEmail`. `default` pasa de `console.warn` a `throw`. Lead responde en <30s |
| 2.2 | `/capture` asíncrono | `backend/src/server.ts:193-208` | Fase síncrona (contacto + mensaje) responde 200; `enrichWebLead()` clasifica en background con `.catch(log)`. El opt-out por `isStopWord` queda en la fase síncrona |
| 2.3 | **Plantillas de WhatsApp aprobadas** | `channels/whatsapp.ts` (`sendWhatsAppTemplate`), `db/` (columnas `template_name`/`template_lang`/`params` en `sequence_steps`), `sequences/engine.ts:210-212` | La decisión plantilla vs. texto libre se toma **en el momento del envío** leyendo `contacts.last_inbound_at`, no al inscribir. Pasos 2-4 se entregan |
| 2.4 | Reintentos con backoff en secuencias | migración `attempts int / last_error text`, `sequences/engine.ts:108-111` | Errores transitorios (429/5xx/131047) reprograman `next_run_at` manteniendo `active`; `failed` solo tras 3 intentos. `renderStepMessage` cae a `renderTemplate` si el LLM falla |
| 2.5 | Fallback y traza para `generateReply` | `orchestrator.ts:149-174` | try/catch que envuelve reply+send+save: acuse fijo, `needs_human=true`, evento `reply_failed` en `events` |
| 2.6 | Mensajes no-texto de WhatsApp | `channels/whatsapp.ts:33-38,53`, `server.ts:244`, `orchestrator.ts:69` | Audio/imagen/documento/interactive crean contacto y mensaje, disparan acuse y `needs_human=true`. Test del parser con payload de audio y de `list_reply` |
| 2.7 | Cerrar el circuito de `ai_autopilot` | `repo.ts:77-94` (devolver `{id, aiAutopilot}`), `orchestrator.ts` (corte antes del bloque del agente), `leads/[id]/page.tsx` (switch) | Con el piloto apagado la IA no responde pero el inbound se guarda, se clasifica y el opt-out se procesa. El escalado apaga el piloto |
| 2.8 | **Responder desde el panel** | nuevo `POST /messages/send` en `server.ts` (patrón `requireInternalAuth`), `api/backend/[...path]/route.ts:12-25`, `leads/[id]/actions.ts`, `leads/[id]/page.tsx:143-160` | El vendedor responde sin salir del panel; queda en `messages` con `senderType:'human'` |
| 2.9 | Normalización E.164 | nuevo `backend/src/lib/phone.ts`, `scrapers/google-maps.ts:91,67,50`, `repo.ts:29,57`, `channels/whatsapp.ts:6` | FieldMask usa `internationalPhoneNumber`; guardián final en `sendWhatsAppText`; backfill SQL de los prospects ya guardados |
| 2.10 | Baja funcional por email | `channels/email.ts:18-25`, nuevo `GET/POST /baja/:token` con HMAC, migración `prospects.opted_out` | `List-Unsubscribe` + `List-Unsubscribe-Post: One-Click`, pie con razón social y dirección, y filtro `.eq('opted_out', false)` en `prospecting/engine.ts:47` y guarda en `:153` |
| 2.11 | Condiciones de parada comercial en secuencias | `sequences/engine.ts:129-139` | Se detiene si `stage in ('qualified','negotiating','customer','lost')` o si existe una `order` confirmada. Trigger reevaluado antes de cada paso vía `matchesTrigger()` compartido |
| 2.12 | Consentimiento auditable de la landing | `landing/index.html:684,768`, `server.ts:193`, `orchestrator.ts:180`, `repo.ts` (`recordWebConsent`) | 400 si `consent !== true`; se guarda IP, UA, `policy_version` y texto aceptado, con `source:'web_form'` y un evento `consent_granted` append-only |
| 2.13 | Anti-ráfaga | `sequences/engine.ts:22-29`, `prospecting/engine.ts:130` | Jitter 0-90 min sobre las 09:00, salto de fin de semana, y reprogramación de `next_run_at` fuera de ventana en vez de `return false` |
| 2.14 | Venta → embudo | `pedidos/actions.ts:186-211`, `tendencias/page.tsx` | `confirmOrder` con update condicional `.eq('status','draft').select()`, mueve `stage='customer'` (respetando la guarda de `rescore.ts:19`) e inserta evento `order_confirmed`. `/tendencias` muestra ingresos y ticket medio |
| 2.15 | Captura de UTM | `landing/index.html`, `server.ts:193`, `tendencias/page.tsx:59` | First-touch en `sessionStorage`, whitelist estricta de 9 claves con truncado a 200 chars antes de tocar `contacts.metadata`, y serie `byCampaign` en el gráfico. **Sin (b) el dato queda invisible** |

### 🌊 Ola 3 — Estructural

| # | Acción | Archivos | Hecho cuando |
|---|---|---|---|
| 3.1 | Idempotencia y claim de filas | `db/schema.sql` (unique parcial en `messages(external_id)`, `unique(enrollment_id, step_order)`), `sequences/engine.ts:97-102,236-247`, `worker/sequences.ts:22` | Update condicional sobre `next_run_at` para reclamar; `.eq('current_step', enr.current_step)` en el avance; guardia de reentrada en el worker; un solo disparador activo |
| 3.2 | Cola durable de inbound | nueva tabla `inbound_events(external_id unique, payload, status, attempts, next_attempt_at, last_error)`, `server.ts:224`, worker consumidor, hook `onClose`/SIGTERM | Un redeploy no pierde mensajes en vuelo; dead-letter visible en el panel |
| 3.3 | Inscripción vía SQL, sin `limit(500)` | función SQL con `NOT EXISTS` + `ON CONFLICT DO NOTHING`, invocada por RPC desde `sequences/engine.ts:60` | Con 5.000 contactos en `new`, los leads nuevos siguen inscribiéndose. Índice único parcial `where status='active'` para permitir reinscripción |
| 3.4 | Timestamps de etapa | `db/schema.sql:88` (+`stage_changed_at`, `first_qualified_at`, `became_customer_at`), función `set_contact_stage()`, migrar `repo.ts:134`, `ventas/actions.ts:18`, `leads/[id]/actions.ts:36` | Se puede calcular tasa etapa→etapa y días en cada etapa |
| 3.5 | Entregabilidad observable | `channels/whatsapp.ts:44` (devolver `value.statuses`), `server.ts:236`, columnas `provider_message_id`/`error_code`/`error_title`, webhook Svix de Resend + tabla `email_suppressions` | El panel distingue enviado de entregado de fallido; `account_update` (quality rating) alerta **antes** de la restricción |
| 3.6 | Coste y CPL | nuevo `db/add_cost_tracking.sql` (`llm_usage`, `ad_spend`), `llmWithUsage()` en `router.ts:67,78` con inserción fire-and-forget, vista `v_cpl` | Existe CAC por campaña. **Orden obligatorio: UTM (2.15) antes que la vista.** Añadir rate-limit por IP en `/capture` antes de instrumentar |
| 3.7 | Retención y derechos ARCO | `consents.contact_id` de `cascade` a modelo que preserve evidencia, `eraseSubject(email\|phone)`, tombstone consultado por `importer.ts:114` y `prospecting/engine.ts:47`, job de purga en el cron con `x-cron-secret` | Una solicitud de eliminación se ejecuta y se acredita en un paso, sin destruir la prueba de consentimiento |
| 3.8 | Decidir y alinear la política de datos | `landing/politica.html`, `README.md:6-9`, `captacion/search.ts:474-486`, `scrapers/google-maps.ts` | **Decisión de negocio primero**: (A) mantener prospección → documentar interés legítimo, identificar al responsable con RUC y domicilio, corregir el README; o (B) eliminar el segmento `tipo:'natural'`. Política, README y código **en el mismo commit** |
| 3.9 | Places: finalidad y retención | `scrapers/google-maps.ts:91`, nueva columna `place_id` única, `places_refreshed_at`, job de refresco | Antes de tocar retención: decidir si Places puede seguir siendo la fuente — el telemarketing figura entre los usos prohibidos de Maps Platform. Revocación de la key mata todo `/captacion` |
| 3.10 | Ficha y acciones de prospecto | nueva `dashboard/src/app/prospeccion/[id]/page.tsx`, `prospeccion/actions.ts` | Descartar, marcar respondido y convertir a mano; filtro de rama movido a la consulta con `count:'exact'` en vez de filtrar 200 filas en memoria |
| 3.11 | Atribución de pedidos | `db/add_orders.sql` (+`conversation_id`, `attribution jsonb`), snapshot en `confirmOrder` | Se puede atribuir un dólar concreto a la secuencia, campaña o agente que lo cerró |

---

## 4. Qué NO tocar

Está bien resuelto y no debe reabrirse en este trabajo:

- **Opt-out legal por WhatsApp.** `isStopWord` (`orchestrator.ts:26-38`) es local, por palabra completa, sin coste y **no depende de la IA**. Es el backstop correcto cuando la clasificación falle: consérvese tal cual en cualquier refactor de `classifyMessage`.
- **La RPC `opt_out_contact`** (`db/schema.sql:305-327`): transaccional y auditable. Los arreglos deben **extenderla** para propagar a `prospects`, nunca crear una segunda vía de baja.
- **La guarda de `rescore.ts:19`** que bloquea recalcular contactos `customer`/`lost`. Es el patrón correcto — el problema es que falta en la ruta automática, no que sobre aquí.
- **La arquitectura de fallback multi-proveedor** del router. El diseño es bueno; solo le faltan timeouts para que funcione.
- **El diseño de capacidades del agente publicado** (`agent-capabilities.ts`) y el marcador de escalada: el mecanismo de detección funciona; lo que falta es la pantalla que lo muestre.
- **Los índices ya creados**: `idx_contacts_needs_human` (`db/add_ai_agents.sql:68`) e `idx_messages_contact` soportan los filtros propuestos sin migración adicional.
- **`saveMessage` acepta `senderType:'human'`** (`repo.ts:103`) y el enum ya existe en `db/schema.sql:42`: la respuesta manual desde el panel no requiere cambios de esquema.
- **La verificación de firma `X-Hub-Signature-256`** del webhook y la idempotencia por `messageId` (commit `4634bd6`): la corrección es mover *cuándo* se marca el `messageId`, no rehacer la verificación.
- **La instrumentación de Sentry** (commit `48999ea`): úsese como destino de las alertas nuevas en vez de montar otro canal.
- **El horario de silencio 21-09 en TZ Ecuador** dentro de Docker (`Dockerfile:24`): el concepto y la TZ son correctos; solo falta jitter y garantizar la TZ cuando se ejecuta fuera del contenedor.

---

# Lo que le falta al sistema y ni siquiera aparece como hallazgo (el código no existe)

Verificado con greps sobre todo el repo (excluyendo `node_modules`): no hay tablas, endpoints ni componentes para nada de lo que sigue. Prioridad = impacto comercial / riesgo ÷ esfuerzo.

---

## P0 — Bloqueantes: sin esto, piezas ya construidas no funcionan

### 1. Plantillas de WhatsApp aprobadas (Message Templates)
**No existe:** `backend/src/channels/whatsapp.ts` solo tiene `sendWhatsAppText` con `type:'text'`; no hay ninguna función `type:'template'`, ninguna referencia a `/message_templates`, ninguna columna `template_name`/`template_lang` en `sequence_steps` (`db/schema.sql:230-243`) ni en `outreach_steps` (`db/add_prospecting.sql`), y ningún chequeo de la ventana de servicio de 24 h.
**Por qué importa:** es la infraestructura que falta para que *todo* el motor de seguimiento (cadencia +24/72/96/120 h, `db/seed_sequences.sql:18-38`) pueda entregar algo. Sin plantillas, el sistema no tiene forma legal ni técnica de iniciar conversación; con ellas, el follow-up pasa de 0 % de entrega a operativo. Es el único ítem que desbloquea código ya escrito y pagado.
**Esfuerzo:** M (2-4 días de código: sender de plantillas + columnas + selector ventana/plantilla) + tiempo de aprobación en Meta (días, fuera de control).

### 2. Canales de salida distintos de WhatsApp (email transaccional cableado, SMS)
**No existe:** `backend/src/channels/send.ts:12` es literalmente `// TODO Fase 2: instagram, facebook, email` — el `default` solo hace `console.warn`. `sendEmail` (`channels/email.ts`) existe pero **no está enchufado** a `sendByChannel`; solo lo usa la prospección.
**Por qué importa:** la landing exige teléfono pero acepta email, `contacts` admite 6 canales (`db/schema.sql:17`) y `sequences.channel` acepta cualquiera (`schema.sql:225`) — una secuencia de email consumiría pasos sin enviar nada. Hoy si un lead solo deja correo, el sistema no tiene ningún camino para hablarle. Es una línea de código de cableado que multiplica la cobertura del embudo.
**Esfuerzo:** S para email (cablear `sendEmail` + resolver identidad de canal). M para SMS/Instagram.

### 3. Bandeja de trabajo del vendedor: responder desde el panel + alertas
**No existe:** no hay endpoint de envío manual en `backend/src/server.ts`, no hay server action de respuesta en `dashboard/src/app/leads/[id]/actions.ts` (solo optOut/toggleAutopilot/updateStage/deleteContact), y no hay ningún sistema de notificación: grep de `slack|notific|push|alert` no devuelve nada funcional fuera de dependencias.
**Por qué importa:** el handoff humano está a medio construir (`sender_type='human'` existe en el enum, `needs_human` existe como columna) pero no hay ni entrada de texto ni aviso. Un lead que pide hablar con una persona no genera ninguna señal en ningún dispositivo de nadie. Sin esto, todo lo demás produce leads que nadie atiende.
**Esfuerzo:** M (endpoint + form + permiso en el proxy). S adicional para un aviso por email/WhatsApp al comercial.

---

## P1 — Alto retorno, ausencia total

### 4. Integración de anuncios con conversiones (Meta CAPI / Google Enhanced Conversions)
**No existe:** cero código de Pixel, Conversions API, `gclid`/`fbclid`, `access_token` de Meta Ads o Google Ads API. `dashboard/src/app/audiencias/page.tsx:48` es solo un instructivo de texto para que un humano suba un CSV a mano.
**Por qué importa:** sin devolver la conversión (lead cualificado, pedido confirmado) a las plataformas, sus algoritmos optimizan a ciegas hacia clics baratos, no hacia ventas. Es la palanca con mayor apalancamiento sobre el gasto publicitario que existe, y es puramente aditiva: no requiere tocar el embudo.
**Esfuerzo:** M (CAPI server-side desde el backend: hash de email/teléfono, evento `Lead` + `Purchase` en `confirmOrder`). Depende de que exista antes la captura de UTM/click-ids.

### 5. Reporting de ROI por canal (gasto + ingresos en el mismo sitio)
**No existe:** ninguna tabla de gasto de medios en `db/` (los 16 `.sql` no incluyen `ad_spend` ni coste por campaña), ningún campo de coste en `outreach_campaigns`, ninguna lectura de `usage`/tokens del LLM, y `/tendencias` nunca consulta `orders`.
**Por qué importa:** hoy no se puede responder "¿cuánto me cuesta un cliente y de dónde vienen los que compran?". Se están tomando decisiones de inversión con un porcentaje de conversión all-time como único dato. Aunque se arregle la atribución UTM, sigue faltando el lado del gasto: no hay dónde meterlo.
**Esfuerzo:** M (tabla `ad_spend` cargable por CSV + tabla `llm_usage` + vista de CPL/ROAS). Carga manual mensual es suficiente para empezar; la ingesta automática desde las APIs de Ads es L.

### 6. Reactivación de leads fríos (campañas de "despertar")
**No existe:** el único trigger de secuencias interpreta `stage|interest_level|min_score` (`sequences/engine.ts:61-63`) — no hay ningún concepto de recencia (`days_since_last_inbound`), ni secuencia sembrada para leads dormidos, ni forma de reinscribir a nadie: `unique (sequence_id, contact_id)` (`db/schema.sql:254`) es permanente.
**Por qué importa:** la base de contactos ya pagada (los que dijeron "ahora no") es el inventario más barato que tiene el negocio y hoy es material muerto: entra una vez, se agota la secuencia de 4 pasos, y nunca más se le vuelve a hablar por diseño de esquema.
**Esfuerzo:** S-M (índice único parcial por `status='active'` + trigger por recencia + una secuencia sembrada). Depende de #1 para poder entregar.

### 7. Recuperación de pedidos abandonados
**No existe:** `orders` nace en `draft` (`pedidos/actions.ts:19`) y se queda ahí para siempre si nadie confirma; no hay job que barra borradores antiguos, ni recordatorio automático, ni `payment_link` (grep de `stripe|paypal|payphone|checkout`: nada). `payment_method` es texto libre (`pedidos/actions.ts:176`) — no hay cobro real.
**Por qué importa:** un pedido en `draft` es un cliente que ya eligió producto y cantidad — la intención más alta medible del sistema — y se abandona sin un solo recordatorio. Es la recuperación con mejor tasa de conversión de cualquier automatización de marketing.
**Esfuerzo:** S para el recordatorio (job que busca `draft` con `updated_at > 24h` y dispara mensaje). L si se quiere link de pago real.

### 8. Lead scoring por comportamiento (el score actual es 100 % opinión del LLM)
**No existe:** `lead_score` sale entero de un JSON del modelo (`ai/classify.ts:41`), sin ninguna señal objetiva: no se registra apertura de email, clic, visita repetida a la landing, tiempo de respuesta, número de mensajes ni interacción con producto. No hay tabla de eventos de comportamiento web (`events` solo guarda hitos internos, `db/schema.sql:263`).
**Por qué importa:** un score sin componente conductual no es comparable entre leads ni estable en el tiempo; ordena mal la cola del vendedor. Un modelo híbrido (reglas deterministas de comportamiento + juicio del LLM sobre el texto) es más barato, auditable y explicable ante el equipo comercial.
**Esfuerzo:** M (tabla de eventos de comportamiento + tracking de clics en enlaces salientes + fórmula de puntos sumada al score de IA).

---

## P2 — Necesarios para escalar y mejorar

### 9. A/B testing de mensajes y secuencias
**No existe:** ni `experiment`, ni `variant`, ni asignación aleatoria en ningún archivo. `sequence_steps` tiene un solo `message_template`/`ai_prompt` por paso; `outreach_steps` igual. No hay forma de comparar dos versiones ni de medir cuál convierte.
**Por qué importa:** el sistema genera mensajes con IA a escala pero no tiene ningún mecanismo de aprendizaje: nadie sabe si el prompt de `writer.ts` funciona mejor o peor que una plantilla fija. Sin experimentación, la calidad del copy queda congelada en la intuición del día que se escribió el prompt.
**Esfuerzo:** M (columna `variant_group` en steps + asignación determinista por hash del contact_id + reporte de conversión por variante). Requiere antes #5 para poder medir el resultado.

### 10. Nurturing por contenido (no solo persecución comercial)
**No existe:** no hay tabla de contenidos/activos, ni blog, ni lead magnet, ni newsletter — grep de `blog|ebook|webinar|lead_magnet|newsletter`: cero. Los 4 pasos sembrados (`db/seed_sequences.sql`) son todos pedidos de venta: recordatorio, oferta, despedida.
**Por qué importa:** la secuencia actual solo sirve para leads listos para comprar; al que está en fase de descubrimiento (niveles 1-3 de consciencia de Schwartz que el propio `ai/psychology.ts` clasifica) le pide comprar cuatro veces y luego se rinde. Se descarta a la mayor parte del embudo por no tener nada que enviarle salvo presión comercial. Es incoherente con el perfilado psicológico ya implementado.
**Esfuerzo:** M técnico (biblioteca de contenidos + paso de secuencia tipo `content` + segmentación por `awareness`), pero el coste real es de producción editorial, no de código.

### 11. Preferencias de comunicación y centro de suscripción
**No existe:** `consents` es binario opt-in/opt-out por canal (`db/schema.sql:147-158`); no hay frecuencia, ni temas, ni página pública donde el titular gestione nada. El opt-out solo es ejecutable por WhatsApp.
**Por qué importa:** hoy la única alternativa que se le da al cliente entre "recibirlo todo" y "baja total" es la baja total — se pierde el contacto entero por un exceso de frecuencia. Un centro de preferencias convierte bajas en reducciones de frecuencia, y de paso es la pieza que exige la LOPDP/GDPR y el `List-Unsubscribe` de Gmail/Outlook.
**Esfuerzo:** M (página pública con token firmado + columnas de preferencia + respeto en los dos motores).

### 12. Programa de referidos y postventa (NPS, reseñas, recompra)
**No existe:** grep de `referral|referid|nps|encuesta|survey|cupon`: nada. El embudo termina en `stage='customer'` y `orders.status='delivered'`; después no ocurre absolutamente nada — ninguna secuencia dispara sobre clientes.
**Por qué importa:** el cliente ya ganado es el lead más barato del sistema (recompra) y la mejor fuente de leads nuevos (referido/reseña), y hoy es el único segmento con cero automatización. Además, sin encuesta postventa no hay ninguna señal de calidad del servicio entrando al sistema.
**Esfuerzo:** S para la secuencia postventa (una vez existan #1 y #6). M para referidos con código/atribución.

### 13. Formularios y landings múltiples (una sola página, un solo formulario)
**No existe:** `landing/index.html` es la única entrada web, con un único formulario y un único `POST /capture`. No hay constructor de landings, ni variantes por campaña, ni formularios embebibles, ni `landing_page` guardado en el contacto.
**Por qué importa:** no se puede lanzar una campaña de anuncios con página dedicada ni medir qué oferta convierte mejor; todo el tráfico pagado aterriza en la misma página genérica, lo que hunde la tasa de conversión y hace imposible el punto #9 a nivel de captación.
**Esfuerzo:** M (parametrizar la landing por querystring + persistir `landing_page`/oferta en el contacto). L si se quiere constructor real.

### 14. Observabilidad y salud de canal (panel de operación)
**No existe:** no hay ninguna pantalla de estado del sistema: no se leen los `statuses` del webhook de Meta, no hay webhook de bounces de Resend, no se registra el quality rating, no hay conteo de enrollments `failed` en `/sequences`, y el worker no inicializa Sentry (solo `server.ts`).
**Por qué importa:** todos los fallos de este sistema son silenciosos por diseño (fallbacks mudos, `console.error` en background). El operador se entera de que el canal murió cuando un cliente se queja. Un tablero de salud es lo que convierte 20 hallazgos de "fallo invisible" en "fallo visible en 5 minutos".
**Esfuerzo:** M (procesar `statuses`, webhook Resend, página `/salud` con colas, fallidos y latencia por proveedor).

---

## Resumen de secuencia recomendada

1. **#1 plantillas + #2 email cableado** — sin canal de salida válido, nada de lo demás entrega un solo mensaje.
2. **#3 bandeja + alertas** — para que los leads que ya entran se atiendan.
3. **#4 conversiones a Ads + #5 ROI** — para dejar de gastar a ciegas (requieren la captura de UTM ya identificada como hallazgo).
4. **#6 reactivación + #7 abandonados** — recuperar el inventario ya pagado; alto retorno y bajo esfuerzo una vez existe #1.
5. **#8 a #14** — mejora continua y escala.


---

# Anexo — 57 hallazgos confirmados (severidad | esfuerzo | lente | titulo | ubicacion)

```
alto | S | fugas-embudo | La condición no_reply_since_last_step cierra la secuencia en el paso 1 sin enviar nada | backend/src/sequences/engine.ts:170
alto | M | fugas-embudo | El lead de la landing nunca recibe respuesta ni puede ser contactado por ningún canal | backend/src/orchestrator.ts:190
alto | S | fugas-embudo | needs_human=true no se muestra en ninguna pantalla del panel | backend/src/orchestrator.ts:165
medio | S | fugas-embudo | El interruptor de piloto automático (ai_autopilot) no lo lee nadie: la IA sigue respondiendo sobre el asesor | dashboard/src/app/leads/[id]/actions.ts:24
alto | S | fugas-embudo | Un fallo del LLM devuelve al cliente ganado a stage 'new' con score 0 | backend/src/orchestrator.ts:108
medio | M | fugas-embudo | El mensaje de WhatsApp se marca como visto antes de procesarlo y el error se traga: se pierde definitivamente | backend/src/server.ts:240
alto | M | fugas-embudo | Un error transitorio marca el enrollment como 'failed' de forma terminal e invisible | backend/src/sequences/engine.ts:108
medio | S | fugas-embudo | Si el POST a /capture falla, el formulario descarta los datos del lead | landing/index.html:773
alto | M | velocidad-respuesta | El lead web nunca recibe respuesta automática: el primer contacto tarda 24 h (o depende de que un humano abra el panel) | backend/src/orchestrator.ts:218
alto | S | velocidad-respuesta | Ninguna llamada externa tiene timeout: un proveedor de IA colgado congela la respuesta indefinidamente | backend/src/ai/router.ts:46
alto | S | velocidad-respuesta | Si la cadena de IA falla al redactar, el mensaje del cliente queda sin respuesta para siempre, en silencio | backend/src/orchestrator.ts:149
alto | M | velocidad-respuesta | La ruta caliente encadena 2 llamadas de IA y 6 viajes a BD en serie antes de contestar | backend/src/orchestrator.ts:139
alto | M | velocidad-respuesta | Los mensajes de WhatsApp que no son texto (audios, imágenes, botones) se descartan: el lead no recibe nada y ni siquiera queda registrado | backend/src/channels/whatsapp.ts:53
bajo | L | velocidad-respuesta | El procesamiento del webhook es una promesa flotante sin cola ni persistencia: un redeploy borra los mensajes en vuelo | backend/src/server.ts:233
alto | M | velocidad-respuesta | La escalada a humano no avisa a nadie: `needs_human` se escribe en la BD y no se muestra en ninguna parte del panel | backend/src/orchestrator.ts:165
medio | S | velocidad-respuesta | El formulario de la landing bloquea al usuario esperando la clasificación de IA | backend/src/server.ts:196
critico | S | ia-prompts | La clasificación de cada mensaje entrante se hace SIN historial: la IA juzga el mensaje aislado y hace retroceder el embudo | backend/src/orchestrator.ts:93
alto | S | ia-prompts | El fallback neutro del clasificador se escribe en la base como si fuera una clasificación real y borra el trabajo del embudo | backend/src/ai/classify.ts:45
medio | M | ia-prompts | El prompt de respuesta prohíbe inventar precios pero le inyecta precios ambiguos ('desde X') y le pide no copiarlos literal | backend/src/ai/reply.ts:74
alto | M | ia-prompts | Salida del LLM sin modo JSON, sin temperature y sin validación de esquema: el embudo oscila y los valores inválidos se pierden en silencio | backend/src/ai/classify.ts:40
medio | S | ia-prompts | Ninguna llamada lee finish_reason/stop_reason: las respuestas que agotan max_tokens se envían al cliente cortadas a media frase | backend/src/ai/router.ts:70
alto | S | ia-prompts | generateReply no tiene fallback: si la cadena de proveedores falla, el cliente se queda sin respuesta y nadie lo sabe | backend/src/ai/reply.ts:85
medio | M | ia-prompts | El prompt de clasificación no define qué significa cada etapa ni cómo calcular lead_score, y no tiene un solo ejemplo | backend/src/ai/classify.ts:19
alto | S | secuencias-cadencia | La condicion no_reply_since_last_step cancela la secuencia ANTES del paso 1 en todo lead que nunca recibio un mensaje saliente (todos los leads web) | backend/src/sequences/engine.ts:170
critico | L | secuencias-cadencia | La cadencia 24/72/96/120h envia texto libre por WhatsApp fuera de la ventana de servicio de 24h: todo enrollment termina en 'failed' terminal | backend/src/sequences/engine.ts:212
alto | M | secuencias-cadencia | Cualquier error transitorio marca el enrollment 'failed' para siempre: no hay reintentos, backoff ni requeue | backend/src/sequences/engine.ts:110
alto | M | secuencias-cadencia | La inscripcion se atasca a partir de 500 contactos en la etapa disparadora: los leads nuevos dejan de entrar en la secuencia | backend/src/sequences/engine.ts:65
alto | M | secuencias-cadencia | Sin claim de filas ni idempotencia: dos ejecuciones solapadas envian el mismo paso dos veces al mismo cliente | backend/src/sequences/engine.ts:97
alto | M | secuencias-cadencia | No hay condicion de parada por avance comercial: el que compra o esta negociando sigue recibiendo mensajes de 'no quiero insistir mas' | backend/src/sequences/engine.ts:136
medio | M | secuencias-cadencia | Quiet hours: reprogramacion a las 09:00 exactas sin jitter y sin tope diario ni fines de semana — rafaga matinal y multiples mensajes el mismo dia | backend/src/sequences/engine.ts:27
critico | M | entregabilidad | Las secuencias de seguimiento envian texto libre de WhatsApp fuera de la ventana de 24 h: todo paso posterior al primero falla y el enrollment muere | C:\Users\digic\Dropbox\Programas\marketing\backend\src\sequences\engine.ts:212
alto | S | entregabilidad | La prospeccion en frio manda WhatsApp de texto libre a numeros que nunca escribieron: rechazo garantizado y riesgo real de baneo del WABA | C:\Users\digic\Dropbox\Programas\marketing\backend\src\prospecting\engine.ts:257
alto | M | entregabilidad | Los telefonos de Google Maps se guardan en formato nacional y se envian tal cual a la Cloud API | C:\Users\digic\Dropbox\Programas\marketing\backend\src\prospecting\scrapers\google-maps.ts:117
alto | M | entregabilidad | El email en frio sale sin List-Unsubscribe, sin enlace de baja y con la empresa deliberadamente oculta | C:\Users\digic\Dropbox\Programas\marketing\backend\src\channels\email.ts:24
alto | M | entregabilidad | Cero visibilidad de entregabilidad: se ignoran los `statuses` del webhook y los codigos de error de Meta | C:\Users\digic\Dropbox\Programas\marketing\backend\src\channels\whatsapp.ts:26
medio | M | entregabilidad | Rafagas de envio al abrir la ventana horaria, sin tope diario y con la hora en la TZ equivocada | C:\Users\digic\Dropbox\Programas\marketing\backend\src\prospecting\engine.ts:130
alto | M | entregabilidad | Los prospectos no tienen opt-out y no se cruzan con quienes ya pidieron la baja en el CRM | C:\Users\digic\Dropbox\Programas\marketing\backend\src\prospecting\engine.ts:47
critico | M | cumplimiento | El opt-out por email es físicamente imposible: sin List-Unsubscribe, sin enlace de baja y sin webhook de correo entrante | backend/src/channels/email.ts:18
alto | S | cumplimiento | El consentimiento de la landing no se envía ni se registra: `consents` queda como 'inbound_message' sin evidencia auditable | landing/index.html:684
alto | M | cumplimiento | La política de privacidad publicada declara base legal 'consentimiento' y contradice la prospección en frío que el código sí ejecuta | landing/politica.html:36
bajo | M | cumplimiento | WhatsApp en frío con mensaje de texto libre: baneo del número casi garantizado y sin registro de opt-in | backend/src/prospecting/engine.ts:256
alto | L | cumplimiento | Sin política de retención ni borrado: nada caduca, y los derechos ARCO prometidos no tienen mecanismo | landing/politica.html:44
alto | S | cumplimiento | El opt-out solo existe para WhatsApp y web; no hay ninguna acción de baja en el panel para prospectos | backend/src/orchestrator.ts:111
medio | M | cumplimiento | Retención indefinida de contenido de Google Places contra los Términos de Maps Platform | backend/src/prospecting/scrapers/google-maps.ts:63
alto | S | medicion | Una venta confirmada no mueve el embudo ni entra en ninguna métrica: los ingresos quedan desatribuidos | dashboard/src/app/pedidos/actions.ts:186
alto | M | medicion | Cero captura de UTM/campaña en la landing y en /capture: imposible saber qué anuncio trajo el lead | landing/index.html:768
alto | M | medicion | No existe ningún timestamp de transición de etapa: no se puede calcular tasa etapa→etapa ni velocidad del embudo | db/schema.sql:88
alto | M | medicion | Coste por lead imposible de calcular: ni gasto publicitario ni coste de IA se registran en ninguna parte | backend/src/ai/router.ts:67
medio | M | medicion | Los KPIs del tablero se truncan y se degradan en silencio: limit(5000) sin orden, agregación en memoria y conversión all-time | dashboard/src/app/tendencias/page.tsx:44
bajo | M | medicion | Los pedidos no guardan ninguna traza de qué los originó (conversación, secuencia, campaña, agente IA) | db/add_orders.sql:20
alto | M | operacion | El vendedor no puede responder al cliente desde el panel: la conversación es solo lectura | C:\Users\digic\Dropbox\Programas\marketing\dashboard\src\app\leads\[id]\page.tsx:143
alto | S | operacion | El escalado a humano (needs_human) no se muestra ni se filtra en ninguna vista | C:\Users\digic\Dropbox\Programas\marketing\dashboard\src\app\leads\page.tsx:16
alto | M | operacion | El interruptor de piloto automático de la IA es código muerto: el vendedor no puede callarla para atender él | C:\Users\digic\Dropbox\Programas\marketing\dashboard\src\app\leads\[id]\actions.ts:21
medio | M | operacion | No hay ninguna vista de SLA ni de leads sin tocar: la única prioridad es un score congelado | C:\Users\digic\Dropbox\Programas\marketing\dashboard\src\app\ventas\page.tsx:31
alto | S | operacion | /leads no tiene buscador ni paginación: solo existen los 200 mejores por score | C:\Users\digic\Dropbox\Programas\marketing\dashboard\src\app\leads\page.tsx:14
medio | S | operacion | Ningún dato de contacto es accionable: teléfonos y emails son texto plano | C:\Users\digic\Dropbox\Programas\marketing\dashboard\src\app\leads\[id]\page.tsx:82
alto | L | operacion | El pipeline de prospectos es una tabla muerta: no se puede abrir, descartar ni trabajar un prospecto | C:\Users\digic\Dropbox\Programas\marketing\dashboard\src\app\prospeccion\page.tsx:222
```
