import { classifyMessage } from './ai/classify.js';
import { generateReply } from './ai/reply.js';
import { analyzePsychology } from './ai/psychology.js';
import {
  applyClassification,
  findOrCreateContact,
  getOrCreateConversation,
  getSalesContext,
  mergeContactInfo,
  optOutContact,
  saveMessage,
  type Channel,
} from './repo.js';
import { sendByChannel } from './channels/send.js';
import { db } from './db.js';
import { convertProspectToContact } from './prospecting/engine.js';

const STOP_WORDS = ['stop', 'baja', 'darme de baja', 'no me interesa', 'no escriban', 'unsubscribe'];

function isStopWord(text: string): boolean {
  const t = text.toLowerCase();
  return STOP_WORDS.some((w) => t.includes(w));
}

/** Recupera los últimos N mensajes del contacto como texto plano para contexto. */
export async function getHistory(contactId: string, limit = 8): Promise<string> {
  const { data } = await db
    .from('messages')
    .select('direction, body, created_at')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!data?.length) return '';

  return data
    .reverse()
    .map((m) => `[${m.direction === 'inbound' ? 'Cliente' : 'Nosotros'}]: ${m.body}`)
    .join('\n');
}

/**
 * CEREBRO PRINCIPAL — procesa un mensaje entrante de cualquier canal.
 *
 * Flujo:
 *  1. Identificar / crear contacto
 *  2. Detectar si es un prospecto que responde por primera vez → convertirlo a contacto
 *  3. Clasificar con IA (etapa, intención, score)
 *  4. Si pide baja → opt-out y se termina
 *  5. Analizar perfil psicológico (DISC, consciencia, motor emocional)
 *  6. Generar respuesta hiper-personalizada con IA
 *  7. Enviar y guardar
 */
export async function handleInboundMessage(opts: {
  channel: Channel;
  externalId: string;
  text: string;
  name?: string;
  messageId?: string;
}): Promise<void> {
  const contact = await findOrCreateContact({
    channel: opts.channel,
    externalId: opts.externalId,
    displayName: opts.name,
    phone: opts.channel === 'whatsapp' ? opts.externalId : undefined,
  });

  // Si venía como prospecto de outreach, conviértelo automáticamente a contacto.
  // Ninguna de estas tres llamadas depende del resultado de las otras (solo de contact.id),
  // así que se piden en paralelo.
  const [, conversationId, salesContext] = await Promise.all([
    opts.channel === 'whatsapp' && opts.externalId
      ? convertProspectToContact(opts.externalId, contact.id).catch(() => null)
      : Promise.resolve(null),
    getOrCreateConversation(contact.id, opts.channel),
    getSalesContext(),
  ]);
  const { catalog, context } = salesContext;

  // Clasificar + historial en paralelo
  const [classification, history] = await Promise.all([
    classifyMessage({ messageText: opts.text, productsCatalog: catalog }),
    getHistory(contact.id),
  ]);

  await saveMessage({
    conversationId,
    contactId: contact.id,
    channel: opts.channel,
    direction: 'inbound',
    body: opts.text,
    aiIntent: classification.intent,
    aiAnalysis: classification,
    externalId: opts.messageId,
  });

  await applyClassification(contact.id, classification);

  // ── BAJA AUTOMÁTICA (cumplimiento legal LOPDP) ───────────────────────────
  if (classification.intent === 'pedir_baja' || isStopWord(opts.text)) {
    await optOutContact(contact.id, opts.channel, `Cliente solicitó baja: "${opts.text}"`);
    const bye = 'Listo, no volverás a recibir nuestros mensajes. Si algún día nos necesitas, aquí estaremos. 🙏';
    await sendByChannel(opts.channel, opts.externalId, bye);
    await saveMessage({
      conversationId, contactId: contact.id, channel: opts.channel,
      direction: 'outbound', body: bye, senderType: 'system',
    });
    return;
  }

  if (contact.marketing_opted_out) return;

  // ── PERFIL PSICOLÓGICO ───────────────────────────────────────────────────
  // Se analiza en segundo plano solo si hay suficiente historial o mensaje significativo
  let psychProfile;
  if (opts.text.length > 15 || history.length > 0) {
    psychProfile = await analyzePsychology({
      messages:      history + `\n[Cliente]: ${opts.text}`,
      contactName:   contact.display_name,
      stage:         contact.stage,
      productContext: context.slice(0, 400),
    }).catch(() => undefined);
  }

  // ── RESPUESTA HIPER-PERSONALIZADA ────────────────────────────────────────
  const reply = await generateReply({
    messageText:  opts.text,
    history,
    contactName:  contact.display_name,
    salesContext: context,
    psychProfile,
    stage:        contact.stage,
  });

  await sendByChannel(opts.channel, opts.externalId, reply);
  await saveMessage({
    conversationId, contactId: contact.id, channel: opts.channel,
    direction: 'outbound', body: reply, senderType: 'ai',
  });
}

/**
 * Captura un lead desde formulario web.
 */
export async function handleWebLead(opts: {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  interestedProduct?: string;
}): Promise<{ contactId: string }> {
  const externalId = (opts.email || opts.phone || '').trim().toLowerCase();
  if (!externalId) throw new Error('El formulario requiere email o teléfono.');

  const contact = await findOrCreateContact({
    channel: 'web',
    externalId,
    displayName: opts.name,
    phone: opts.phone,
  });

  await mergeContactInfo(contact.id, { email: opts.email, fullName: opts.name, phone: opts.phone });

  const conversationId = await getOrCreateConversation(contact.id, 'web');

  const text =
    opts.message?.trim() ||
    `Nuevo contacto desde formulario web.${opts.interestedProduct ? ` Interés: ${opts.interestedProduct}.` : ''}`;

  const { catalog } = await getSalesContext();
  const classification = await classifyMessage({ messageText: text, productsCatalog: catalog });

  await saveMessage({
    conversationId,
    contactId: contact.id,
    channel: 'web',
    direction: 'inbound',
    body: text,
    aiIntent: classification.intent,
    aiAnalysis: classification,
  });

  await applyClassification(contact.id, classification);

  if (classification.intent === 'pedir_baja' || isStopWord(text)) {
    await optOutContact(contact.id, 'web', `Lead pidió baja en el formulario: "${text}"`);
  }

  return { contactId: contact.id };
}
