/**
 * Captación Activa — Motor de búsqueda inteligente y no invasiva.
 *
 * Principios:
 *  · Proactivo: busca, califica y enriquece automáticamente.
 *  · No invasivo: respeta límites diarios, opt-outs y la LOPDP.
 *  · Psicológico: aplica DISC + Cialdini + Schwartz en cada touchpoint.
 *  · Multicanal: web, Maps, redes sociales, email.
 */

import { llm } from '../ai/router.js';
import { db } from '../db.js';
import { scrapeGoogleMaps } from '../prospecting/scrapers/google-maps.js';
import { qualifyAllNew } from '../prospecting/importer.js';

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

export interface SearchParams {
  industria: string;
  ubicacion?: string;
  tamano?: 'micro' | 'pyme' | 'empresa' | 'todas';
  palabras_clave?: string[];
  objetivo?: string;
  limite?: number;
}

export interface SearchStrategy {
  resumen_cliente_ideal: string;
  queries_google_maps: string[];
  queries_web: string[];
  hashtags_instagram: string[];
  grupos_facebook: string[];
  busquedas_linkedin: string[];
  patrones_email: string[];
  anzuelo_principal: string;
  objeciones_top3: string[];
  mensaje_apertura: string;
  mensaje_seguimiento_1: string;
  mensaje_seguimiento_2: string;
  canales_recomendados: string[];
  mejor_horario: string;
  advertencias: string[];
}

export interface ProspectFromText {
  full_name?: string;
  company?: string;
  email?: string;
  phone?: string;
  website?: string;
  industry?: string;
  location?: string;
  notes?: string;
  fit_score?: number;
}

export interface DonationCampaign {
  titulo: string;
  subtitulo: string;
  historia_emotiva: string;
  llamado_accion: string;
  mensaje_whatsapp: string;
  mensaje_email_asunto: string;
  mensaje_email_cuerpo: string;
  mensaje_instagram: string;
  metas_sugeridas: { monto: number; descripcion: string }[];
  argumento_psicologico: string;
}

// ─────────────────────────────────────────────────────────────
// 1. Estrategia de búsqueda con Mistral
// ─────────────────────────────────────────────────────────────

export async function generarEstrategia(params: SearchParams): Promise<SearchStrategy> {
  const system = `Eres un experto en marketing digital, psicología del consumidor y prospección B2B/B2C en Ecuador y Latinoamérica.
Tu tarea es generar una estrategia de captación de clientes DETALLADA, PRÁCTICA y NO INVASIVA.

Aplica:
- DISC para definir el perfil de comunicación del cliente ideal
- Cialdini (reciprocidad, autoridad, prueba social, escasez) en los mensajes
- Schwartz (nivel de consciencia) para calibrar el mensaje según madurez del lead
- PAS (Problema → Agitación → Solución) en el anzuelo principal

Devuelve SOLO JSON válido con estas claves exactas:
{
  "resumen_cliente_ideal": "descripción en 2-3 oraciones del cliente perfecto",
  "queries_google_maps": ["query1", "query2", "query3", "query4", "query5"],
  "queries_web": ["búsqueda1", "búsqueda2", "búsqueda3"],
  "hashtags_instagram": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "grupos_facebook": ["nombre grupo 1", "nombre grupo 2", "nombre grupo 3"],
  "busquedas_linkedin": ["filtro1", "filtro2", "filtro3"],
  "patrones_email": ["patron1@{dominio}", "patron2@{dominio}"],
  "anzuelo_principal": "pregunta o afirmación que activa el dolor/deseo del cliente ideal",
  "objeciones_top3": ["objeción 1", "objeción 2", "objeción 3"],
  "mensaje_apertura": "mensaje inicial de contacto (WhatsApp/email), máx 3 líneas, con gancho psicológico, sin ser invasivo",
  "mensaje_seguimiento_1": "2do contacto si no responde (3 días después), énfasis en valor",
  "mensaje_seguimiento_2": "3er contacto si no responde (7 días después), cierre con escasez/urgencia suave",
  "canales_recomendados": ["canal1", "canal2"],
  "mejor_horario": "descripción del mejor momento para contactar este perfil",
  "advertencias": ["consideración legal o ética 1", "consideración 2"]
}

Los mensajes deben ser naturales, personalizados y aportar valor real. Nada de spam genérico.`;

  const user = `Genera una estrategia completa de captación para:
- Industria objetivo: ${params.industria}
- Ubicación: ${params.ubicacion ?? 'Ecuador (principalmente)'}
- Tamaño de empresa: ${params.tamano ?? 'todas'}
- Palabras clave adicionales: ${(params.palabras_clave ?? []).join(', ') || 'ninguna'}
- Objetivo de la captación: ${params.objetivo ?? 'generar nuevos clientes para Marketing MAP (sistema de automatización con IA)'}`;

  const text = await llm('classify', system, user, 2000);
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(json) as SearchStrategy;
}

// ─────────────────────────────────────────────────────────────
// 2. Búsqueda en Google Maps (negocios locales)
// ─────────────────────────────────────────────────────────────

export async function buscarEnMaps(params: SearchParams): Promise<{
  encontrados: number;
  guardados: number;
  sourceId: string;
}> {
  const query = params.ubicacion
    ? `${params.industria} en ${params.ubicacion}`
    : `${params.industria} en Ecuador`;

  const result = await scrapeGoogleMaps({
    query,
    maxResults: params.limite ?? 20,
    qualifyWithAi: true,
  });

  return {
    encontrados: result.found,
    guardados: result.saved,
    sourceId: result.sourceId,
  };
}

// ─────────────────────────────────────────────────────────────
// 3. Analizar texto pegado (LinkedIn, redes, directorios)
// ─────────────────────────────────────────────────────────────

export async function analizarTextoProspectos(texto: string, fuente?: string): Promise<{
  prospectos: ProspectFromText[];
  sourceId: string;
}> {
  const system = `Eres un experto en extracción de datos de contactos comerciales.
Analiza el texto proporcionado y extrae TODOS los posibles prospectos/contactos.

Devuelve SOLO JSON:
{
  "prospectos": [
    {
      "full_name": "nombre completo o null",
      "company": "empresa o null",
      "email": "correo@dominio.com o null",
      "phone": "número con código país o null",
      "website": "URL o null",
      "industry": "sector inferido o null",
      "location": "ciudad/país o null",
      "notes": "dato relevante observado o null",
      "fit_score": número 0-100 según cuánto encaja como cliente potencial
    }
  ]
}

Inferir industry y fit_score basándote en el contexto. Sin texto fuera del JSON.`;

  const user = `Fuente: ${fuente ?? 'texto pegado por el usuario'}

${texto.slice(0, 8000)}`;

  const raw = await llm('classify', system, user, 2000);
  const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  const { prospectos } = JSON.parse(json) as { prospectos: ProspectFromText[] };

  // Crear fuente de prospecto
  const { data: source, error: sourceError } = await db
    .from('prospect_sources')
    .insert({
      name:   `Análisis IA: ${fuente ?? 'texto manual'}`,
      type:   'manual_ai',
      config: { fuente, chars: texto.length },
    })
    .select('id')
    .single();
  if (!source) throw new Error(`Error creando fuente en BD: ${sourceError?.message ?? 'respuesta vacía'}`);

  const sourceId = source.id;
  let guardados = 0;

  for (const p of prospectos) {
    if (!p.full_name && !p.company && !p.email && !p.phone) continue;

    // Deduplicar por email o teléfono
    if (p.email) {
      const { count } = await db.from('prospects').select('id', { count: 'exact', head: true }).eq('email', p.email);
      if ((count ?? 0) > 0) continue;
    }
    if (p.phone) {
      const { count } = await db.from('prospects').select('id', { count: 'exact', head: true }).eq('phone', p.phone);
      if ((count ?? 0) > 0) continue;
    }

    const { error } = await db.from('prospects').insert({
      source_id:  sourceId,
      full_name:  p.full_name ?? null,
      company:    p.company   ?? null,
      email:      p.email     ?? null,
      phone:      p.phone     ?? null,
      website:    p.website   ?? null,
      industry:   p.industry  ?? null,
      location:   p.location  ?? null,
      fit_score:  p.fit_score ?? null,
      status:     'new',
      raw_data:   { notes: p.notes, fuente },
    });

    if (!error) guardados++;
  }

  // Calificar en background
  if (guardados > 0) {
    qualifyAllNew(sourceId).catch((e) => console.error('[captacion] error calificando:', e));
  }

  return { prospectos, sourceId };
}

// ─────────────────────────────────────────────────────────────
// 4. Generar patrones de email para un dominio
// ─────────────────────────────────────────────────────────────

export async function descubrirEmailsDeEmpresa(empresa: string, dominio?: string): Promise<string[]> {
  const system = `Eres un experto en email discovery. Dado el nombre de una empresa y su dominio web,
genera los patrones de email más probables que usan sus empleados.
Devuelve SOLO un array JSON de strings con los patrones, donde {n} = nombre, {a} = apellido:
["patron1", "patron2", "patron3", "patron4", "patron5"]`;

  const user = `Empresa: ${empresa}${dominio ? `\nDominio: ${dominio}` : ''}`;

  try {
    const text = await llm('classify', system, user, 300);
    const json = text.slice(text.indexOf('['), text.lastIndexOf(']') + 1);
    return JSON.parse(json) as string[];
  } catch {
    return [
      `{n}.{a}@${dominio ?? empresa.toLowerCase().replace(/\s+/g, '')}.com`,
      `{n}@${dominio ?? empresa.toLowerCase().replace(/\s+/g, '')}.com`,
      `contacto@${dominio ?? empresa.toLowerCase().replace(/\s+/g, '')}.com`,
    ];
  }
}

// ─────────────────────────────────────────────────────────────
// 5. Generar campaña de donaciones
// ─────────────────────────────────────────────────────────────

export async function generarCampanaDonacion(params: {
  causa: string;
  organizacion?: string;
  meta_monto?: number;
  publico_objetivo?: string;
}): Promise<DonationCampaign> {
  const system = `Eres un experto en campañas de recaudación de fondos, marketing emocional y psicología de la generosidad.
Aplica:
- Storytelling emocional (identidad del donante: "yo soy alguien que ayuda")
- Prueba social (otros ya están donando)
- Especificidad del impacto ("$20 = X beneficios concretos")
- Urgencia real, no fabricada
- Cialdini: reciprocidad, compromiso progresivo, autoridad

Devuelve SOLO JSON:
{
  "titulo": "título poderoso de la campaña (máx 8 palabras)",
  "subtitulo": "subtítulo que amplía el impacto (1 línea)",
  "historia_emotiva": "párrafo de 3-4 oraciones que conecta emocionalmente con la causa, incluye un personaje específico",
  "llamado_accion": "frase de CTA que combina urgencia y valor (máx 10 palabras)",
  "mensaje_whatsapp": "mensaje corto para compartir por WhatsApp (máx 160 caracteres)",
  "mensaje_email_asunto": "asunto del email (máx 50 caracteres, que genere apertura)",
  "mensaje_email_cuerpo": "cuerpo del email de donación (3-4 párrafos, emotivo y específico)",
  "mensaje_instagram": "caption para Instagram (con emojis, hashtags relevantes Ecuador, máx 300 caracteres)",
  "metas_sugeridas": [
    {"monto": 5, "descripcion": "qué logra $5"},
    {"monto": 20, "descripcion": "qué logra $20"},
    {"monto": 50, "descripcion": "qué logra $50"},
    {"monto": 100, "descripcion": "qué logra $100"}
  ],
  "argumento_psicologico": "explicación en 2 oraciones de por qué este mensaje funcionará psicológicamente"
}`;

  const user = `Causa: ${params.causa}
Organización: ${params.organizacion ?? 'JOMAP Consultores / Marketing MAP'}
Meta de recaudación: ${params.meta_monto ? `$${params.meta_monto}` : 'no definida'}
Público objetivo: ${params.publico_objetivo ?? 'empresarios y profesionales ecuatorianos'}`;

  const text = await llm('reply', system, user, 2000);
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(json) as DonationCampaign;
}

// ─────────────────────────────────────────────────────────────
// 6. Búsqueda de mercado progresiva por producto
// ─────────────────────────────────────────────────────────────

export const CIUDADES_ECUADOR = [
  { nombre: 'Cuenca',         region: 'Azuay' },
  { nombre: 'Guayaquil',      region: 'Guayas' },
  { nombre: 'Quito',          region: 'Pichincha' },
  { nombre: 'Ambato',         region: 'Tungurahua' },
  { nombre: 'Loja',           region: 'Loja' },
  { nombre: 'Manta',          region: 'Manabí' },
  { nombre: 'Riobamba',       region: 'Chimborazo' },
  { nombre: 'Machala',        region: 'El Oro' },
  { nombre: 'Ibarra',         region: 'Imbabura' },
  { nombre: 'Santo Domingo',  region: 'Santo Domingo' },
];

export interface MercadoInferido {
  cliente_ideal: string;
  industrias: string[];
  queries_maps: string[];       // 3 búsquedas dirigidas a compradores (no proveedores)
  query_maps_principal: string; // primera query — compatibilidad con el frontend
  por_que_lo_necesitan: string;
}

// ─────────────────────────────────────────────────────────────
// Clasificador de rama — mapea producto → rama del ecosistema JOMAP
// ─────────────────────────────────────────────────────────────

export interface RamaClasificacion {
  rama: string;           // rama del ecosistema
  producto_objetivo: string; // producto a ofrecer
  etiqueta_crm: string;   // tag para filtrar en el CRM
}

/**
 * Determina a qué rama del ecosistema JOMAP pertenece el producto
 * y qué producto específico es el más adecuado para ofrecer.
 */
export function clasificarPorRama(producto: string): RamaClasificacion {
  const p = producto.toLowerCase();

  if (/tribut|contab|fiscal|impuest|sri|declara|renta|iva|retenci|balances?|auditoria/.test(p))
    return { rama: 'tributaria',   producto_objetivo: 'Tributos Web · CMAJ Asociados',        etiqueta_crm: 'tributaria' };

  if (/ingles|inglés|english|idioma|toefl|cambridge|ielts|idiom/.test(p))
    return { rama: 'idiomas',      producto_objetivo: 'Golden Gate English Center',            etiqueta_crm: 'idiomas' };

  if (/psicolog|bienestar|mental|emocional|coaching|mentor|terapia|burnout|salud mental/.test(p))
    return { rama: 'salud_mental', producto_objetivo: 'Fundación Pensamiento Libre',           etiqueta_crm: 'salud_mental' };

  if (/academ|estudio|nivelaci|educaci|curso|colegio|universid|tutoría|tutor|senescyt|preuniver/.test(p))
    return { rama: 'educacion',    producto_objetivo: 'Atlas Centro de Estudios',              etiqueta_crm: 'educacion' };

  if (/firma.?electr|certificad|token|e-sign/.test(p))
    return { rama: 'firma_digital', producto_objetivo: 'CMAJ Asociados · Firma Electrónica',  etiqueta_crm: 'firma_digital' };

  if (/marketing|publicidad|redes|social.?media|ventas|captaci|clientes|leads|campañ|anuncio/.test(p))
    return { rama: 'marketing',    producto_objetivo: 'Marketing MAP',                         etiqueta_crm: 'marketing' };

  // Por defecto: marketing MAP sirve a cualquier negocio
  return   { rama: 'general',     producto_objetivo: 'Marketing MAP',                          etiqueta_crm: 'general' };
}

/**
 * A partir de la descripción de un producto, la IA infiere qué tipos de
 * negocios son los mejores compradores potenciales en Ecuador.
 * Genera 3 búsquedas de Maps dirigidas a COMPRADORES, no a proveedores.
 */
export async function inferirMercadoDesdeProducto(producto: string): Promise<MercadoInferido> {
  const system = `Eres un experto en prospección comercial B2B/B2C en Ecuador.
Tu tarea: dado un producto/servicio, identificar quiénes son los COMPRADORES POTENCIALES
y generar búsquedas precisas de Google Maps para encontrarlos.

REGLA CRÍTICA: Las queries de Maps deben buscar los NEGOCIOS QUE COMPRAN el servicio,
NO los que lo venden. Ejemplo CORRECTO para "servicios tributarios":
- "restaurantes y cafeterías" (necesitan contador)
- "clínicas y consultorios médicos" (necesitan contador)
- "ferreterías y materiales de construcción" (necesitan contador)
Ejemplo INCORRECTO: "estudios contables" (eso son competidores, no compradores)

Devuelve SOLO JSON válido:
{
  "cliente_ideal": "descripción en 1 oración del comprador perfecto en Ecuador",
  "industrias": ["sector comprador 1", "sector comprador 2", "sector comprador 3"],
  "queries_maps": [
    "tipo de negocio comprador 1 (el de mayor volumen en Ecuador)",
    "tipo de negocio comprador 2 (segundo segmento más rentable)",
    "tipo de negocio comprador 3 (nicho con alta necesidad)"
  ],
  "por_que_lo_necesitan": "argumento psicológico concreto en 1 oración de por qué este cliente necesita el producto urgentemente"
}

Reglas:
- queries_maps: exactamente 3, sin mencionar ciudad, específicas para el contexto ecuatoriano
- Cada query debe ser un TIPO DE NEGOCIO que habitualmente compra este servicio
- Usa términos que la gente usa en Ecuador (no anglicismos)`;

  const user = `Producto/servicio a promocionar: ${producto}`;
  const text = await llm('classify', system, user, 800);
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const parsed = JSON.parse(json) as Omit<MercadoInferido, 'query_maps_principal'> & { query_maps_principal?: string };
  // compatibilidad: query_maps_principal = primera de las 3 queries
  const queries = parsed.queries_maps ?? [];
  return {
    ...parsed,
    queries_maps: queries,
    query_maps_principal: parsed.query_maps_principal ?? queries[0] ?? '',
  };
}

/**
 * Busca prospectos para un producto en una ciudad específica de Ecuador.
 * Corre hasta 3 queries dirigidas a COMPRADORES y fusiona resultados.
 * Solo recopila datos comerciales públicos (Maps) — cumple LOPDP Art. 23.
 */
export async function buscarMercadoCiudad(params: {
  producto: string;
  queries_maps: string[];   // hasta 3 queries de compradores
  ciudad: string;
  limite?: number;
}): Promise<{ ciudad: string; encontrados: number; guardados: number; sourceId: string; rama: RamaClasificacion }> {
  const rama = clasificarPorRama(params.producto);
  const extraData = {
    rama:               rama.rama,
    producto_objetivo:  rama.producto_objetivo,
    etiqueta_crm:       rama.etiqueta_crm,
    producto_promovido: params.producto,
    ciudad_captacion:   params.ciudad,
    fuente_captacion:   'google_maps_activo',
    lopdp_base_legal:   'interes_legitimo_comercial',
    lopdp_tipo_datos:   'informacion_comercial_publica',
    lopdp_origen:       'google_maps_listado_publico',
    lopdp_opt_out:      true,
  };

  // Correr hasta 3 queries en paralelo (cada una busca un segmento de compradores)
  const limitePorQuery = Math.ceil((params.limite ?? 15) / params.queries_maps.length);
  const results = await Promise.all(
    params.queries_maps.map((q) =>
      scrapeGoogleMaps({
        query:         `${q} en ${params.ciudad} Ecuador`,
        maxResults:    limitePorQuery,
        qualifyWithAi: true,
        extraData,
      }).catch((e) => { console.error(`[captacion] query falló: ${q} — ${e.message}`); return null; })
    )
  );

  const total = results.reduce(
    (acc, r) => r ? { encontrados: acc.encontrados + r.found, guardados: acc.guardados + r.saved } : acc,
    { encontrados: 0, guardados: 0 }
  );
  // sourceId: usar el de la primera query exitosa
  const sourceId = results.find((r) => r !== null)?.sourceId ?? '';

  return {
    ciudad:      params.ciudad,
    encontrados: total.encontrados,
    guardados:   total.guardados,
    sourceId,
    rama,
  };
}

// ─────────────────────────────────────────────────────────────
// 7. Estadísticas del módulo
// ─────────────────────────────────────────────────────────────

export async function getCaptacionStats(): Promise<{
  total_prospectos: number;
  calificados: number;
  convertidos: number;
  enviados_semana: number;
  fuentes: { nombre: string; count: number }[];
}> {
  const [totalRes, calRes, convRes, weekRes, fuentesRes] = await Promise.all([
    db.from('prospects').select('id', { count: 'exact', head: true }),
    db.from('prospects').select('id', { count: 'exact', head: true }).eq('status', 'qualified'),
    db.from('prospects').select('id', { count: 'exact', head: true }).eq('status', 'converted'),
    db.from('outreach_messages').select('id', { count: 'exact', head: true })
      .gte('sent_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    db.from('prospect_sources').select('name, prospects(count)').limit(10),
  ]);

  const fuentes = (fuentesRes.data ?? []).map((s: any) => ({
    nombre: s.name,
    count:  Array.isArray(s.prospects) ? s.prospects[0]?.count ?? 0 : 0,
  }));

  return {
    total_prospectos: totalRes.count ?? 0,
    calificados:      calRes.count   ?? 0,
    convertidos:      convRes.count  ?? 0,
    enviados_semana:  weekRes.count  ?? 0,
    fuentes,
  };
}
