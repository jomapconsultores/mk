import { db } from './db.js';

export type Channel = 'whatsapp' | 'instagram' | 'facebook' | 'email' | 'web' | 'sms';

export interface Contact {
  id: string;
  display_name: string | null;
  full_name: string | null;
  phone: string | null;
  marketing_opted_out: boolean;
  stage: string;
}

/**
 * Encuentra al contacto por su identidad en un canal, o lo crea junto con su identidad.
 * Asi un mismo numero de WhatsApp siempre mapea al mismo contacto.
 */
export async function findOrCreateContact(opts: {
  channel: Channel;
  externalId: string;     // nº WhatsApp, IG id, email...
  displayName?: string;
  phone?: string;
}): Promise<Contact> {
  // 1) ¿Ya existe esta identidad?
  const { data: identity } = await db
    .from('channel_identities')
    .select('contact_id')
    .eq('channel', opts.channel)
    .eq('external_id', opts.externalId)
    .maybeSingle();

  if (identity?.contact_id) {
    const { data: contact } = await db
      .from('contacts')
      .select('id, display_name, full_name, phone, marketing_opted_out, stage')
      .eq('id', identity.contact_id)
      .single();
    return contact as Contact;
  }

  // 2) Crear contacto nuevo
  const { data: contact, error } = await db
    .from('contacts')
    .insert({
      display_name: opts.displayName ?? null,
      phone: opts.phone ?? null,
      source_channel: opts.channel,
    })
    .select('id, display_name, full_name, phone, marketing_opted_out, stage')
    .single();
  if (error) throw error;

  // 3) Crear su identidad de canal
  await db.from('channel_identities').insert({
    contact_id: contact!.id,
    channel: opts.channel,
    external_id: opts.externalId,
    handle: opts.displayName ?? null,
  });

  // 4) Por defecto, escribir primero = opt-in en ese canal
  await db.from('consents').upsert(
    { contact_id: contact!.id, channel: opts.channel, status: 'opted_in', source: 'inbound_message' },
    { onConflict: 'contact_id,channel' },
  );

  await db.from('events').insert({
    contact_id: contact!.id,
    type: 'lead_created',
    payload: { channel: opts.channel },
  });

  return contact as Contact;
}

/**
 * Garantiza que el contacto tenga identidad en un canal (idempotente).
 *
 * Necesario para el lead web: llega con identidad 'web', pero las secuencias y
 * los envíos salen por 'whatsapp'/'email'. Sin esto, getChannelIdentity devuelve
 * null y el seguimiento se cierra sin haber escrito nunca.
 */
export async function ensureChannelIdentity(opts: {
  contactId: string;
  channel: Channel;
  externalId: string;
  handle?: string | null;
  consentSource?: string;
}): Promise<void> {
  const { data: existing } = await db
    .from('channel_identities')
    .select('id')
    .eq('channel', opts.channel)
    .eq('external_id', opts.externalId)
    .maybeSingle();
  if (existing?.id) return;

  const { error } = await db.from('channel_identities').insert({
    contact_id: opts.contactId,
    channel: opts.channel,
    external_id: opts.externalId,
    handle: opts.handle ?? null,
  });
  // Carrera con otro proceso que la creó entremedias: no es un fallo.
  if (error && !String(error.message).toLowerCase().includes('duplicate')) {
    console.error('[ensureChannelIdentity] no se pudo crear la identidad:', error.message);
    return;
  }

  await db.from('consents').upsert(
    {
      contact_id: opts.contactId,
      channel: opts.channel,
      status: 'opted_in',
      source: opts.consentSource ?? 'web_form',
    },
    { onConflict: 'contact_id,channel' },
  );
}

/** Devuelve la conversacion abierta del contacto en un canal, o la crea. */
export async function getOrCreateConversation(contactId: string, channel: Channel): Promise<string> {
  return (await getOrCreateConversationFull(contactId, channel)).id;
}

/**
 * Igual que getOrCreateConversation pero devuelve tambien ai_autopilot, que es
 * el interruptor "responde la IA sola en este hilo". Existia en la base y en el
 * panel, pero el backend nunca lo leia: el asesor lo apagaba y el bot seguia
 * contestando encima de la negociacion.
 */
export async function getOrCreateConversationFull(
  contactId: string,
  channel: Channel,
): Promise<{ id: string; aiAutopilot: boolean }> {
  const { data: existing } = await db
    .from('conversations')
    .select('id, ai_autopilot')
    .eq('contact_id', contactId)
    .eq('channel', channel)
    .eq('status', 'open')
    .maybeSingle();
  if (existing?.id) return { id: existing.id, aiAutopilot: existing.ai_autopilot !== false };

  const { data, error } = await db
    .from('conversations')
    .insert({ contact_id: contactId, channel })
    .select('id, ai_autopilot')
    .single();
  if (error) throw error;
  return { id: data!.id, aiAutopilot: data!.ai_autopilot !== false };
}

/** Guarda un mensaje (entrante o saliente). */
export async function saveMessage(opts: {
  conversationId: string;
  contactId: string;
  channel: Channel;
  direction: 'inbound' | 'outbound';
  body: string;
  senderType?: 'ai' | 'human' | 'sequence' | 'system';
  aiIntent?: string;
  aiAnalysis?: unknown;
  externalId?: string;
  agentId?: string;
}): Promise<void> {
  await db.from('messages').insert({
    conversation_id: opts.conversationId,
    contact_id: opts.contactId,
    channel: opts.channel,
    direction: opts.direction,
    body: opts.body,
    sender_type: opts.senderType ?? null,
    ai_intent: opts.aiIntent ?? null,
    ai_analysis: opts.aiAnalysis ?? null,
    external_id: opts.externalId ?? null,
    agent_id: opts.agentId ?? null,
  });

  const stamp =
    opts.direction === 'inbound'
      ? { last_inbound_at: new Date().toISOString() }
      : { last_contacted_at: new Date().toISOString() };
  await db.from('contacts').update(stamp).eq('id', opts.contactId);
  await db.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', opts.conversationId);
}

const STAGES = ['new', 'engaged', 'qualified', 'negotiating', 'customer', 'lost'] as const;
const INTEREST_LEVELS = ['low', 'medium', 'high'] as const;
// Etapas que la IA no puede revertir sola: un cliente que ya compro o que ya
// esta negociando no vuelve a 'new' porque escribio "ok" o porque el LLM fallo.
// Misma guarda que ya aplica la ruta manual de rescore.ts.
const TERMINAL_STAGES = new Set(['customer', 'negotiating', 'lost']);

/**
 * Aplica la clasificacion de la IA al contacto — de forma NO destructiva:
 * valida los enums, no degrada etapas avanzadas y no borra el resumen previo
 * con una cadena vacia. Un valor inventado por el LLM se descarta en vez de
 * fallar en silencio contra el CHECK de la tabla.
 */
export async function applyClassification(contactId: string, c: {
  stage: string; interest_level: string; lead_score: number; summary: string;
}): Promise<void> {
  const { data: current } = await db
    .from('contacts')
    .select('stage, ai_summary')
    .eq('id', contactId)
    .maybeSingle();

  const patch: Record<string, unknown> = {};

  if ((STAGES as readonly string[]).includes(c.stage) && !TERMINAL_STAGES.has(current?.stage ?? '')) {
    patch.stage = c.stage;
  }
  if ((INTEREST_LEVELS as readonly string[]).includes(c.interest_level)) {
    patch.interest_level = c.interest_level;
  }
  if (Number.isFinite(c.lead_score)) {
    patch.lead_score = Math.max(0, Math.min(100, Math.round(c.lead_score)));
  }
  if (c.summary?.trim()) patch.ai_summary = c.summary.trim();

  if (Object.keys(patch).length) {
    const { error } = await db.from('contacts').update(patch).eq('id', contactId);
    if (error) {
      console.error('[applyClassification] update fallo:', error.message, { contactId, patch });
      return;
    }
  }

  await db.from('events').insert({
    contact_id: contactId,
    type: 'classified',
    payload: { ...c, applied: patch, previous_stage: current?.stage ?? null },
  });
}

/** Registra la baja (opt-out) llamando a la funcion SQL auditable. */
export async function optOutContact(contactId: string, channel: Channel, reason: string): Promise<void> {
  await db.rpc('opt_out_contact', { p_contact: contactId, p_channel: channel, p_reason: reason });
}

/** Completa datos del contacto (email, nombre) sin pisar lo que ya tenga. */
export async function mergeContactInfo(
  contactId: string,
  info: { email?: string; fullName?: string; phone?: string },
): Promise<void> {
  const patch: Record<string, string> = {};
  if (info.email) patch.email = info.email;
  if (info.fullName) patch.full_name = info.fullName;
  if (info.phone) patch.phone = info.phone;
  if (Object.keys(patch).length) await db.from('contacts').update(patch).eq('id', contactId);
}

/** Devuelve el external_id (p.ej. nº de WhatsApp) del contacto en un canal. */
export async function getChannelIdentity(contactId: string, channel: Channel): Promise<string | null> {
  const { data } = await db
    .from('channel_identities')
    .select('external_id')
    .eq('contact_id', contactId)
    .eq('channel', channel)
    .maybeSingle();
  return data?.external_id ?? null;
}

/** ¿El contacto envio algun mensaje (inbound) despues de la fecha dada? */
export async function hasInboundSince(contactId: string, sinceIso: string): Promise<boolean> {
  const { count } = await db
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('contact_id', contactId)
    .eq('direction', 'inbound')
    .gt('created_at', sinceIso);
  return (count ?? 0) > 0;
}

/** Contexto de venta: nombres + briefs de productos activos, para la IA. */
export async function getSalesContext(): Promise<{ catalog: string; context: string }> {
  const { data } = await db
    .from('products')
    .select('name, description, price, currency, sales_brief, discount_percent, product_variants(price, discount_percent, is_active)')
    .eq('is_active', true);

  const products = data ?? [];
  const catalog = products.map((p) => p.name).join(', ');
  const context = products
    .map((p) => {
      const variants = ((p as any).product_variants ?? []).filter((v: any) => v.is_active);
      const priceLine = describePriceLine(p, variants);
      return `• ${p.name}${priceLine ? ` (${priceLine})` : ''}: ${p.description ?? ''} ${p.sales_brief ?? ''}`.trim();
    })
    .join('\n');
  return { catalog, context };
}

function effectivePrice(
  basePrice: number | null,
  baseDiscount: number | null,
  v?: { price: number | null; discount_percent: number | null },
): number | null {
  const price = v?.price ?? basePrice;
  const discount = v?.discount_percent ?? baseDiscount;
  if (price == null) return null;
  return discount ? Number((price * (1 - discount / 100)).toFixed(2)) : price;
}

function describePriceLine(p: any, variants: any[]): string {
  if (variants.length === 0) {
    const eff = effectivePrice(p.price, p.discount_percent);
    return eff != null ? `${eff} ${p.currency}` : '';
  }
  const prices = variants
    .map((v) => effectivePrice(p.price, p.discount_percent, v))
    .filter((x: number | null): x is number => x != null);
  if (prices.length === 0) return '';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? `${min} ${p.currency}` : `desde ${min} ${p.currency}`;
}

// =============================================================================
// AGENTES IA — configuración de personalidad/comportamiento sin código.
// Solo puede haber un agente con status='published' a la vez (garantizado por
// un índice único parcial en la base de datos, ver db/add_ai_agents.sql).
// =============================================================================
export type AiAgent = {
  id: string;
  name: string;
  instructions: string;
  capabilities: string[];
  status: 'draft' | 'published';
  published_at: string | null;
};

/** Devuelve el agente actualmente publicado, o null si ninguno lo está. */
export async function getPublishedAgent(): Promise<AiAgent | null> {
  const { data } = await db.from('ai_agents').select('*').eq('status', 'published').maybeSingle();
  return (data as AiAgent) ?? null;
}

/** Devuelve un agente por id (borrador o publicado) — usado por el Playground. */
export async function getAgentById(id: string): Promise<AiAgent | null> {
  const { data } = await db.from('ai_agents').select('*').eq('id', id).maybeSingle();
  return (data as AiAgent) ?? null;
}
