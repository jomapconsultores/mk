import Fastify from 'fastify';
import { config } from './config.js';
import { parseWhatsAppWebhook } from './channels/whatsapp.js';
import { handleInboundMessage, handleWebLead } from './orchestrator.js';
import { runEngineOnce } from './sequences/engine.js';
import { importProspectsFromCsv, qualifyAllNew } from './prospecting/importer.js';
import { scrapeGoogleMaps } from './prospecting/scrapers/google-maps.js';
import { runProspectingOnce } from './prospecting/engine.js';

const app = Fastify({ logger: true });

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
