import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { config } from './config.js';
import { parseWhatsAppWebhook } from './channels/whatsapp.js';
import { handleInboundMessage, handleWebLead } from './orchestrator.js';
import { runEngineOnce } from './sequences/engine.js';
import { importProspectsFromCsv, qualifyAllNew } from './prospecting/importer.js';
import { scrapeGoogleMaps } from './prospecting/scrapers/google-maps.js';
import { runProspectingOnce } from './prospecting/engine.js';
import { fileToText, extractContactsFromText } from './prospecting/smart-extractor.js';
import { db } from './db.js';

const app = Fastify({ logger: true });

// Soporte para uploads multipart (PDF, Excel, CSV)
app.register(multipart, {
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});

// Tolerar cuerpos JSON vacios (el cron puede llegar sin body): se interpretan como {}.
app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
  const text = (body as string)?.trim();
  if (!text) return done(null, {});
  try {
    done(null, JSON.parse(text));
  } catch (err) {
    done(err as Error);
  }
});

// CORS abierto para el endpoint publico de captura (formularios en cualquier dominio).
app.addHook('onRequest', async (req, reply) => {
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') reply.code(204).send();
});

// Raiz: pagina informativa (el backend es una API, no un sitio web).
app.get('/', async (_req, reply) => {
  reply.type('text/html').send(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>marketing-map · API</title>
<style>body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;
align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center}
.box{max-width:480px;padding:32px}h1{color:#818cf8}a{color:#818cf8}</style></head>
<body><div class="box"><h1>marketing-map</h1>
<p>✅ El servidor (API) está funcionando correctamente.</p>
<p style="color:#94a3b8">Esto es el motor por detrás del sistema, no una página para visitar.</p>
<p>Panel del equipo:<br><a href="https://marketing-map.onrender.com">marketing-map.onrender.com</a></p>
<p>Página de captación:<br><a href="https://marketing-map-landing.onrender.com">marketing-map-landing.onrender.com</a></p>
</div></body></html>`);
});

// Salud
app.get('/health', async () => ({ ok: true, service: 'marketing-map-backend' }));

// --- Cron del motor de seguimiento (lo llama un cron externo gratuito) ---
// Protegido con un secreto: se envia en la cabecera "x-cron-secret".
app.post('/cron/run-sequences', async (req, reply) => {
  const secret = (req.headers['x-cron-secret'] as string) ?? '';
  if (!config.cronSecret || secret !== config.cronSecret) {
    return reply.code(401).send({ ok: false, error: 'No autorizado' });
  }
  try {
    const result = await runEngineOnce();
    return reply.code(200).send({ ok: true, ...result });
  } catch (err) {
    app.log.error({ err }, 'Error en /cron/run-sequences');
    return reply.code(500).send({ ok: false, error: (err as Error).message });
  }
});

// --- Captura de leads desde la landing / formularios web ---
app.post('/capture', async (req, reply) => {
  const b = (req.body ?? {}) as Record<string, string>;
  try {
    const { contactId } = await handleWebLead({
      name: b.name,
      email: b.email,
      phone: b.phone,
      message: b.message,
      interestedProduct: b.interested_product,
    });
    return reply.code(200).send({ ok: true, contactId });
  } catch (err) {
    app.log.error({ err }, 'Error en /capture');
    return reply.code(400).send({ ok: false, error: (err as Error).message });
  }
});

// --- Verificacion del webhook de WhatsApp (Meta hace un GET al configurarlo) ---
app.get('/webhooks/whatsapp', async (req, reply) => {
  const q = req.query as Record<string, string>;
  const mode = q['hub.mode'];
  const token = q['hub.verify_token'];
  const challenge = q['hub.challenge'];

  if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
    return reply.code(200).send(challenge);
  }
  return reply.code(403).send('Token de verificacion invalido');
});

// --- Recepcion de mensajes de WhatsApp ---
app.post('/webhooks/whatsapp', async (req, reply) => {
  // Responder rapido a Meta y procesar en segundo plano.
  reply.code(200).send('EVENT_RECEIVED');

  try {
    const incoming = parseWhatsAppWebhook(req.body);
    for (const msg of incoming) {
      await handleInboundMessage({
        channel: 'whatsapp',
        externalId: msg.from,
        text: msg.text,
        name: msg.name,
        messageId: msg.messageId,
      });
    }
  } catch (err) {
    app.log.error({ err }, 'Error procesando webhook de WhatsApp');
  }
});

// ============================================================
// PROSPECCIÓN ACTIVA
// ============================================================

// Cron: ejecutar motor de outreach (inscribir prospectos + enviar mensajes)
app.post('/cron/run-prospecting', async (req, reply) => {
  const secret = (req.headers['x-cron-secret'] as string) ?? '';
  if (!config.cronSecret || secret !== config.cronSecret) {
    return reply.code(401).send({ ok: false, error: 'No autorizado' });
  }
  try {
    const result = await runProspectingOnce();
    return reply.code(200).send({ ok: true, ...result });
  } catch (err) {
    app.log.error({ err }, 'Error en /cron/run-prospecting');
    return reply.code(500).send({ ok: false, error: (err as Error).message });
  }
});

// Importar prospectos desde CSV (texto plano en el body)
app.post('/prospecting/import-csv', async (req, reply) => {
  const b = (req.body ?? {}) as { csv?: string; source_name?: string; qualify?: boolean };
  if (!b.csv) return reply.code(400).send({ ok: false, error: 'Falta el campo csv' });
  try {
    const result = await importProspectsFromCsv({
      csvText:      b.csv,
      sourceName:   b.source_name ?? `Importación ${new Date().toLocaleDateString('es')}`,
      qualifyWithAi: b.qualify !== false,
    });
    return reply.code(200).send({ ok: true, ...result });
  } catch (err) {
    return reply.code(400).send({ ok: false, error: (err as Error).message });
  }
});

// Disparar calificación IA de prospectos pendientes
app.post('/prospecting/qualify', async (req, reply) => {
  const b = (req.body ?? {}) as { source_id?: string };
  qualifyAllNew(b.source_id).catch((e) => app.log.error(e, 'Error calificando prospectos'));
  return reply.code(202).send({ ok: true, message: 'Calificación iniciada en segundo plano' });
});

// Scraping de Google Maps
app.post('/prospecting/scrape-google', async (req, reply) => {
  const b = (req.body ?? {}) as { query?: string; max_results?: number; qualify?: boolean };
  if (!b.query) return reply.code(400).send({ ok: false, error: 'Falta el campo query' });
  try {
    const result = await scrapeGoogleMaps({
      query:         b.query,
      maxResults:    b.max_results ?? 20,
      qualifyWithAi: b.qualify !== false,
    });
    return reply.code(200).send({ ok: true, ...result });
  } catch (err) {
    return reply.code(500).send({ ok: false, error: (err as Error).message });
  }
});

// Listar prospectos con filtros
app.get('/prospecting/prospects', async (req, reply) => {
  const q = (req.query ?? {}) as { status?: string; limit?: string };
  const { data, error } = await (await import('./db.js')).db
    .from('prospects')
    .select('id, full_name, company, email, phone, industry, location, fit_score, status, ai_profile_summary, created_at')
    .eq('status', q.status ?? 'qualified')
    .order('fit_score', { ascending: false })
    .limit(Number(q.limit ?? 100));
  if (error) return reply.code(500).send({ ok: false, error: error.message });
  return reply.code(200).send({ ok: true, prospects: data });
});

// ── Importación inteligente con IA (PDF / Excel / CSV) ─────────────────────
app.post('/prospecting/import-smart', async (req, reply) => {
  let fileBuffer: Buffer | null = null;
  let filename = 'archivo';
  let mimetype = 'text/plain';
  let sourceName = `Importación ${new Date().toLocaleDateString('es')}`;

  try {
    for await (const part of req.parts()) {
      if (part.type === 'file') {
        fileBuffer = await part.toBuffer();
        filename   = part.filename ?? 'archivo';
        mimetype   = part.mimetype ?? 'text/plain';
      } else {
        if (part.fieldname === 'source_name' && part.value) {
          sourceName = String(part.value).trim() || sourceName;
        }
      }
    }
  } catch (err) {
    return reply.code(400).send({ ok: false, error: 'Error leyendo el archivo: ' + (err as Error).message });
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    return reply.code(400).send({ ok: false, error: 'No se recibió ningún archivo.' });
  }

  try {
    // 1. Convertir a texto según tipo de archivo
    const rawText = await fileToText(fileBuffer, mimetype, filename);
    if (!rawText.trim()) {
      return reply.code(400).send({ ok: false, error: 'No se pudo extraer texto del archivo.' });
    }

    // 2. IA extrae contactos estructurados
    const contacts = await extractContactsFromText(rawText, sourceName);
    if (contacts.length === 0) {
      return reply.code(200).send({ ok: true, extracted: 0, imported: 0, duplicates: 0, message: 'La IA no encontró contactos en el archivo.' });
    }

    // 3. Crear fuente
    const { data: source, error: sourceError } = await db
      .from('prospect_sources')
      .insert({ name: sourceName, type: 'smart_import' })
      .select('id')
      .single();
    if (!source) throw new Error(`Error creando fuente: ${sourceError?.message ?? 'respuesta vacía'}`);
    const sourceId = source.id;

    // 4. Insertar con deduplicación por email o teléfono
    let imported   = 0;
    let duplicates = 0;

    for (const c of contacts) {
      const primaryEmail  = c.email_personal ?? c.email_institutional ?? null;
      const primaryPhone  = c.phone_mobile   ?? c.phone_landline      ?? null;
      const fullName      = [c.first_name, c.last_name].filter(Boolean).join(' ') || null;

      // Deduplicar
      if (primaryEmail || primaryPhone) {
        const checks: boolean[] = [];
        if (primaryEmail) {
          const r = await db.from('prospects').select('id', { count: 'exact', head: true })
            .or(`email.eq.${primaryEmail},email_personal.eq.${primaryEmail},email_institutional.eq.${primaryEmail}`);
          checks.push((r.count ?? 0) > 0);
        }
        if (primaryPhone) {
          const r = await db.from('prospects').select('id', { count: 'exact', head: true })
            .or(`phone.eq.${primaryPhone},phone_mobile.eq.${primaryPhone}`);
          checks.push((r.count ?? 0) > 0);
        }
        if (checks.some(Boolean)) { duplicates++; continue; }
      }

      const { error } = await db.from('prospects').insert({
        source_id:            sourceId,
        full_name:            fullName,
        first_name:           c.first_name           ?? null,
        last_name:            c.last_name            ?? null,
        company:              c.company              ?? null,
        email:                primaryEmail,
        email_personal:       c.email_personal       ?? null,
        email_institutional:  c.email_institutional  ?? null,
        phone:                primaryPhone,
        phone_mobile:         c.phone_mobile         ?? null,
        phone_landline:       c.phone_landline        ?? null,
        industry:             c.industry             ?? null,
        location:             c.location             ?? null,
        status:               'new',
        raw_data:             {},
      });

      if (!error) imported++;
      else app.log.error({ err: error }, '[smart-import] error insertando');
    }

    // 5. Calificar en segundo plano con IA
    qualifyAllNew(sourceId).catch((e) => app.log.error(e, '[smart-import] error calificando'));

    return reply.code(200).send({
      ok: true,
      extracted:  contacts.length,
      imported,
      duplicates,
      source_id:  sourceId,
      message:    `Se extrajeron ${contacts.length} contactos. ${imported} importados, ${duplicates} duplicados omitidos. La IA los está calificando en segundo plano.`,
    });

  } catch (err) {
    app.log.error({ err }, '[smart-import] error general');
    return reply.code(500).send({ ok: false, error: (err as Error).message });
  }
});

// ============================================================
// CAPTACIÓN ACTIVA (motor IA de búsqueda de nuevos clientes)
// ============================================================
import {
  generarEstrategia,
  buscarEnMaps,
  analizarTextoProspectos,
  descubrirEmailsDeEmpresa,
  generarCampanaDonacion,
  getCaptacionStats,
  inferirMercadoDesdeProducto,
  buscarMercadoCiudad,
  CIUDADES_ECUADOR,
} from './captacion/search.js';

// Generar estrategia de captación con IA
app.post('/captacion/estrategia', async (req, reply) => {
  const b = (req.body ?? {}) as Record<string, any>;
  if (!b.industria) return reply.code(400).send({ ok: false, error: 'Falta el campo industria' });
  try {
    const estrategia = await generarEstrategia(b);
    return reply.code(200).send({ ok: true, estrategia });
  } catch (err) {
    app.log.error({ err }, 'Error en /captacion/estrategia');
    return reply.code(500).send({ ok: false, error: (err as Error).message });
  }
});

// Buscar negocios en Google Maps
app.post('/captacion/buscar-maps', async (req, reply) => {
  const b = (req.body ?? {}) as Record<string, any>;
  if (!b.industria) return reply.code(400).send({ ok: false, error: 'Falta el campo industria' });
  try {
    const result = await buscarEnMaps(b);
    return reply.code(200).send({ ok: true, ...result });
  } catch (err) {
    app.log.error({ err }, 'Error en /captacion/buscar-maps');
    return reply.code(500).send({ ok: false, error: (err as Error).message });
  }
});

// Analizar texto pegado (LinkedIn, directorios, redes)
app.post('/captacion/analizar-texto', async (req, reply) => {
  const b = (req.body ?? {}) as { texto?: string; fuente?: string };
  if (!b.texto) return reply.code(400).send({ ok: false, error: 'Falta el campo texto' });
  try {
    const result = await analizarTextoProspectos(b.texto, b.fuente);
    return reply.code(200).send({ ok: true, ...result });
  } catch (err) {
    app.log.error({ err }, 'Error en /captacion/analizar-texto');
    return reply.code(500).send({ ok: false, error: (err as Error).message });
  }
});

// Descubrir patrones de email de una empresa
app.post('/captacion/emails-empresa', async (req, reply) => {
  const b = (req.body ?? {}) as { empresa?: string; dominio?: string };
  if (!b.empresa) return reply.code(400).send({ ok: false, error: 'Falta el campo empresa' });
  try {
    const patrones = await descubrirEmailsDeEmpresa(b.empresa, b.dominio);
    return reply.code(200).send({ ok: true, patrones });
  } catch (err) {
    return reply.code(500).send({ ok: false, error: (err as Error).message });
  }
});

// Generar campaña de donaciones
app.post('/captacion/donacion', async (req, reply) => {
  const b = (req.body ?? {}) as Record<string, any>;
  if (!b.causa) return reply.code(400).send({ ok: false, error: 'Falta el campo causa' });
  try {
    const campana = await generarCampanaDonacion(b);
    return reply.code(200).send({ ok: true, campana });
  } catch (err) {
    app.log.error({ err }, 'Error en /captacion/donacion');
    return reply.code(500).send({ ok: false, error: (err as Error).message });
  }
});

// Buscar mercado por producto — progresivo ciudad por ciudad
// Solo recopila datos comerciales públicos (Google Maps) — LOPDP Art. 23
app.post('/captacion/buscar-mercado', async (req, reply) => {
  const b = (req.body ?? {}) as {
    producto?: string;
    ciudad?: string;
    query_maps?: string;
    inferir?: boolean;
    limite?: number;
  };

  if (!b.producto) return reply.code(400).send({ ok: false, error: 'Falta el campo producto' });
  if (!b.ciudad)   return reply.code(400).send({ ok: false, error: 'Falta el campo ciudad' });

  // Validar que la ciudad sea una de las ciudades ecuatorianas aceptadas
  const ciudadValida = CIUDADES_ECUADOR.find(
    (c) => c.nombre.toLowerCase() === b.ciudad!.toLowerCase()
  );
  if (!ciudadValida) return reply.code(400).send({ ok: false, error: 'Ciudad no reconocida' });

  try {
    let mercado: Awaited<ReturnType<typeof inferirMercadoDesdeProducto>> | undefined;
    let queryMaps = b.query_maps;

    if (b.inferir || !queryMaps) {
      mercado = await inferirMercadoDesdeProducto(b.producto);
      queryMaps = mercado.query_maps_principal;
    }

    const resultado = await buscarMercadoCiudad({
      producto: b.producto,
      query_maps: queryMaps!,
      ciudad: b.ciudad,
      limite: b.limite ?? 15,
    });

    return reply.code(200).send({
      ok:              true,
      ciudad:          resultado.ciudad,
      encontrados:     resultado.encontrados,
      guardados:       resultado.guardados,
      sourceId:        resultado.sourceId,
      rama:            resultado.rama.rama,
      producto_objetivo: resultado.rama.producto_objetivo,
      etiqueta_crm:    resultado.rama.etiqueta_crm,
      ...(mercado ? { mercado } : {}),
    });
  } catch (err) {
    app.log.error({ err }, 'Error en /captacion/buscar-mercado');
    return reply.code(500).send({ ok: false, error: (err as Error).message });
  }
});

// Lista de ciudades disponibles para búsqueda progresiva
app.get('/captacion/ciudades', async (_req, reply) => {
  return reply.code(200).send({ ok: true, ciudades: CIUDADES_ECUADOR });
});

// Estadísticas del módulo de captación
app.get('/captacion/stats', async (_req, reply) => {
  try {
    const stats = await getCaptacionStats();
    return reply.code(200).send({ ok: true, ...stats });
  } catch (err) {
    return reply.code(500).send({ ok: false, error: (err as Error).message });
  }
});

// Stats de prospección para el dashboard
app.get('/prospecting/stats', async (_req, reply) => {
  const { db: _db } = await import('./db.js');
  const [byStatus, campaigns, recentSent] = await Promise.all([
    _db.from('prospects').select('status').then(({ data }) => {
      const counts: Record<string, number> = {};
      for (const r of data ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
      return counts;
    }),
    _db.from('outreach_campaigns').select('id, name, is_active, daily_limit'),
    _db.from('outreach_messages').select('id', { count: 'exact', head: true })
       .gte('sent_at', new Date(Date.now() - 7 * 86400000).toISOString()),
  ]);
  return reply.code(200).send({ ok: true, by_status: byStatus, campaigns: campaigns.data, sent_last_7d: recentSent.count ?? 0 });
});

app
  .listen({ port: config.port, host: '0.0.0.0' })
  .then(() => app.log.info(`Backend escuchando en puerto ${config.port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
