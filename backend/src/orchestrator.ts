import { classifyMessage } from './ai/classify.js';
import { generateReply } from './ai/reply.js';
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

/** Palabras que disparan baja inmediata aunque la IA no la detecte. */
const STOP_WORDS = ['stop', 'baja', 'darme de baja', 'no me interesa', 'no escriban', 'unsubscribe'];

function isStopWord(text: string): boolean {
  const t = text.toLowerCase();
  return STOP_WORDS.some((w) => t.includes(w));
}

/**
 * EL CEREBRO: procesa un mensaje entrante de cualquier canal.
 *  1) identifica/crea contacto y conversacion
 *  2) guarda el mensaje
 *  3) clasifica con IA
 *  4) si pide baja -> opt-out y confirma (no sigue vendiendo)
 *  5) si autopilot -> genera y envia respuesta con IA
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

  const conversationId = await getOrCreateConversation(contact.id, opts.channel);

  // Clasificar
  const { catalog, context } = await getSalesContext();
  const classification = await classifyMessage({
    messageText: opts.text,
    productsCatalog: catalog,
  });

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

  // --- BAJA AUTOMATICA (cumplimiento legal) ---
  if (classification.intent === 'pedir_baja' || isStopWord(opts.text)) {
    await optOutContact(contact.id, opts.channel, `Cliente solicito baja: "${opts.text}"`);
    const bye = 'Listo, no volveras a recibir nuestros mensajes. Si algun dia nos necesitas, aqui estaremos. 🙏';
    await sendByChannel(opts.channel, opts.externalId, bye);
    await saveMessage({
      conversationId, contactId: contact.id, channel: opts.channel,
      direction: 'outbound', body: bye, senderType: 'system',
    });
    return;
  }

  // Si el cliente ya estaba dado de baja, no le vendemos.
  if (contact.marketing_opted_out) return;

  // --- AUTO-RESPUESTA con IA ---
  const reply = await generateReply({
    messageText: opts.text,
    contactName: contact.display_name,
    salesContext: context,
  });

  await sendByChannel(opts.channel, opts.externalId, reply);
  await saveMessage({
    conversationId, contactId: contact.id, channel: opts.channel,
    direction: 'outbound', body: reply, senderType: 'ai',
  });
}

/**
 * Captura un lead desde un formulario web (landing). Crea/actualiza el contacto,
 * guarda lo que escribio, lo clasifica con IA y lo deja listo para seguimiento.
 * Devuelve el id del contacto.
 */
export async function handleWebLead(opts: {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  interestedProduct?: string;
}): Promise<{ contactId: string }> {
  // Identificador estable del lead web: email o telefono.
  const externalId = (opts.email || opts.phone || '').trim().toLowerCase();
  if (!externalId) throw new Error('El formulario requiere email o telefono.');

  const contact = await findOrCreateContact({
    channel: 'web',
    externalId,
    displayName: opts.name,
    phone: opts.phone,
  });

  await mergeContactInfo(contact.id, { email: opts.email, fullName: opts.name, phone: opts.phone });

  const conversationId = await getOrCreateConversation(contact.id, 'web');

  // Texto para registrar y clasificar.
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
    await optOutContact(contact.id, 'web', `Lead pidio baja en el formulario: "${text}"`);
  }

  return { contactId: contact.id };
}
