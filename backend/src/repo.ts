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

/** Devuelve la conversacion abierta del contacto en un canal, o la crea. */
export async function getOrCreateConversation(contactId: string, channel: Channel): Promise<string> {
  const { data: existing } = await db
    .from('conversations')
    .select('id')
    .eq('contact_id', contactId)
    .eq('channel', channel)
    .eq('status', 'open')
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data, error } = await db
    .from('conversations')
    .insert({ contact_id: contactId, channel })
    .select('id')
    .single();
  if (error) throw error;
  return data!.id;
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

/** Aplica la clasificacion de la IA al contacto. */
export async function applyClassification(contactId: string, c: {
  stage: string; interest_level: string; lead_score: number; summary: string;
}): Promise<void> {
  await db
    .from('contacts')
    .update({
      stage: c.stage,
      interest_level: c.interest_level,
      lead_score: c.lead_score,
      ai_summary: c.summary,
    })
    .eq('id', contactId);

  await db.from('events').insert({
    contact_id: contactId,
    type: 'classified',
    payload: c,
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
    .select('name, description, price, currency, sales_brief')
    .eq('is_active', true);

  const products = data ?? [];
  const catalog = products.map((p) => p.name).join(', ');
  const context = products
    .map((p) =>
      `• ${p.name}${p.price ? ` (${p.price} ${p.currency})` : ''}: ${p.description ?? ''} ${p.sales_brief ?? ''}`.trim(),
    )
    .join('\n');
  return { catalog, context };
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
