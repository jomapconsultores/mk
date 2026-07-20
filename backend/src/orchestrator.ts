import { classifyMessage } from './ai/classify.js';
import { generateReply } from './ai/reply.js';
import { analyzePsychology } from './ai/psychology.js';
import { ESCALATE_MARKER } from './ai/agents.js';
import {
  applyClassification,
  ensureChannelIdentity,
  findOrCreateContact,
  getOrCreateConversation,
  getOrCreateConversationFull,
  getPublishedAgent,
  getSalesContext,
  mergeContactInfo,
  optOutContact,
  saveMessage,
  type Channel,
} from './repo.js';
import { sendByChannel } from './channels/send.js';
import { db } from './db.js';
import { toE164 } from './lib/phone.js';
import { convertProspectToContact } from './prospecting/engine.js';

const STOP_WORDS = ['stop', 'dar de baja', 'darme de baja', 'no me interesa', 'no escriban', 'unsubscribe'];

function isStopWord(text: string): boolean {
  // Comparación por palabra completa (rodeada de espacios) tras normalizar, para
  // NO dar de baja por substring: 'rebaja', 'trabajando' o 'cuando baja el precio'
  // ya no disparan opt-out. La intención 'pedir_baja' del clasificador IA sigue
  // siendo la señal primaria en handleInboundMessage/handleWebLead.
  const t =
    ' ' +
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() +
    ' ';
  return STOP_WORDS.some((w) => t.includes(' ' + w + ' '));
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

/** Acuse de recibo fijo: se usa cuando la IA no está disponible. */
const ACK_FALLBACK =
  '¡Gracias por escribirnos! Ya recibimos tu mensaje y en breve te contactamos. 🙌';

/**
 * Envía la respuesta y la guarda, con red de seguridad: si la IA falla, sale un
 * acuse fijo igualmente y el contacto se marca para atención humana. Nunca
 * lanza: el objetivo es que el cliente reciba SIEMPRE algo.
 */
async function replyAndSave(opts: {
  conversationId: string;
  contactId: string;
  channel: Channel;
  to: string;
  reply: string | null;
  senderType: 'ai' | 'system';
  agentId?: string;
}): Promise<void> {
  const body = opts.reply?.trim() || ACK_FALLBACK;
  try {
    await sendByChannel(opts.channel, opts.to, body);
    await saveMessage({
      conversationId: opts.conversationId,
      contactId: opts.contactId,
      channel: opts.channel,
      direction: 'outbound',
      body,
      senderType: opts.reply ? opts.senderType : 'system',
      agentId: opts.agentId,
    });
  } catch (err) {
    console.error('[orchestrator] no se pudo entregar la respuesta:', err);
    await db.from('contacts').update({ needs_human: true }).eq('id', opts.contactId);
    await db.from('events').insert({
      contact_id: opts.contactId,
      type: 'reply_failed',
      payload: { channel: opts.channel, error: (err as Error).message },
    });
  }
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
  /** El mensaje original no era texto (nota de voz, foto, documento…). */
  isMedia?: boolean;
}): Promise<void> {
  const contact = await findOrCreateContact({
    channel: opts.channel,
    externalId: opts.externalId,
    displayName: opts.name,
    phone: opts.channel === 'whatsapp' ? opts.externalId : undefined,
  });

  // Si venía como prospecto de outreach, conviértelo automáticamente a contacto
  if (opts.channel === 'whatsapp' && opts.externalId) {
    await convertProspectToContact(opts.externalId, contact.id).catch(() => null);
  }

  const { id: conversationId, aiAutopilot } = await getOrCreateConversationFull(contact.id, opts.channel);

  // El historial va ANTES de clasificar: sin el, un "ok" o un "gracias" de un
  // cliente que venia en 'negotiating' se reclasifica como lead nuevo.
  const [{ catalog, context }, history] = await Promise.all([
    getSalesContext(),
    getHistory(contact.id),
  ]);
  const classification = await classifyMessage({
    messageText: opts.text,
    history,
    currentStage: contact.stage,
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

  // Si el LLM fallo, `classification` es solo relleno neutro: persistirla
  // degradaria el CRM (stage='new', score=0, resumen vacio) en cada caida del
  // proveedor. El opt-out por palabra clave de abajo sigue funcionando igual.
  if (!classification.failed) await applyClassification(contact.id, classification);

  // ── BAJA AUTOMÁTICA (cumplimiento legal LOPDP) ───────────────────────────
  if (classification.intent === 'pedir_baja' || isStopWord(opts.text)) {
    await optOutContact(contact.id, opts.channel, `Cliente solicitó baja: "${opts.text}"`);
    const bye = 'Listo, no volverás a recibir nuestros mensajes. Si algún día nos necesitas, aquí estaremos. 🙏';
    // La baja ya quedó registrada arriba: si la confirmación no se puede
    // entregar (canal sin salida implementada), NO debe tumbar el opt-out.
    try {
      await sendByChannel(opts.channel, opts.externalId, bye);
      await saveMessage({
        conversationId, contactId: contact.id, channel: opts.channel,
        direction: 'outbound', body: bye, senderType: 'system',
      });
    } catch (err) {
      console.error('[orchestrator] baja registrada pero sin confirmación entregada:', err);
    }
    return;
  }

  if (contact.marketing_opted_out) return;

  // ── MENSAJE NO-TEXTO ─────────────────────────────────────────────────────
  // La IA no puede escuchar la nota de voz ni ver la foto: se acusa recibo y se
  // pasa a un humano, en vez de contestar algo genérico o —como antes— tirar el
  // mensaje sin crear siquiera el contacto.
  if (opts.isMedia) {
    await db.from('contacts').update({ needs_human: true }).eq('id', contact.id);
    await db.from('events').insert({
      contact_id: contact.id,
      type: 'media_received',
      payload: { channel: opts.channel },
    });
    await replyAndSave({
      conversationId,
      contactId: contact.id,
      channel: opts.channel,
      to: opts.externalId,
      reply: '¡Gracias! Ya lo recibimos. Un asesor lo revisa y te escribe enseguida. 🙌',
      senderType: 'system',
    });
    return;
  }

  // ── AGENTE IA PUBLICADO ──────────────────────────────────────────────────
  // Sin agente publicado, el default es "responder siempre" (comportamiento
  // idéntico al que existía antes de este módulo). Un agente publicado puede
  // desactivar capacidades puntuales vía sus checkboxes.
  const agent = await getPublishedAgent();
  const caps = new Set(agent?.capabilities ?? []);

  // El piloto automático apagado (por el asesor desde el panel o por un escalado
  // previo) manda sobre todo lo demás: el mensaje ya quedó guardado y
  // clasificado, y la baja ya se procesó arriba — solo se calla la IA.
  if (!aiAutopilot) {
    console.info(`[orchestrator] piloto automático apagado en la conversación ${conversationId}: no responde la IA.`);
    return;
  }

  const shouldAutoReply = !agent || caps.has('chat_whatsapp');
  if (!shouldAutoReply) return; // conversación queda para atención humana

  // ── PERFIL PSICOLÓGICO ───────────────────────────────────────────────────
  // Se analiza en segundo plano solo si hay suficiente historial o mensaje significativo
  let psychProfile;
  const wantsPsych = !agent || caps.has('psych_profiling');
  if (wantsPsych && (opts.text.length > 15 || history.length > 0)) {
    psychProfile = await analyzePsychology({
      messages:      history + `\n[Cliente]: ${opts.text}`,
      contactName:   contact.display_name,
      stage:         contact.stage,
      productContext: context.slice(0, 400),
    }).catch(() => undefined);
  }

  // ── RESPUESTA HIPER-PERSONALIZADA ────────────────────────────────────────
  const wantsCatalog = !agent || caps.has('use_catalog');
  // Si la IA falla, `reply` queda null y replyAndSave manda el acuse fijo: el
  // cliente no se queda sin respuesta y el contacto se marca para un humano.
  let reply = await generateReply({
    messageText:  opts.text,
    history,
    contactName:  contact.display_name,
    salesContext: wantsCatalog ? context : '',
    psychProfile,
    stage:        contact.stage,
    agentInstructions: agent?.instructions,
  }).catch((err) => {
    console.error('[orchestrator] generateReply falló:', err);
    return null as string | null;
  });

  // ── ESCALADO A HUMANO ────────────────────────────────────────────────────
  // El prompt (agregado condicionalmente a agentInstructions al guardar el
  // agente, ver dashboard/src/app/agentes/actions.ts) le pide al modelo
  // responder EXACTAMENTE este marcador si detecta frustración fuerte o un
  // pedido explícito de hablar con una persona.
  if (agent && caps.has('escalate_on_frustration') && reply?.includes(ESCALATE_MARKER)) {
    await db.from('contacts').update({ needs_human: true }).eq('id', contact.id);
    // Al escalar se apaga el piloto automático: si no, la IA seguiría
    // respondiendo en paralelo al asesor que va a tomar la conversación.
    await db.from('conversations').update({ ai_autopilot: false }).eq('id', conversationId);
    reply = 'Entiendo, ya te conecto con alguien de nuestro equipo. En un momento te escriben. 🙏';
  }

  await replyAndSave({
    conversationId,
    contactId: contact.id,
    channel: opts.channel,
    to: opts.externalId,
    reply,
    senderType: 'ai',
    agentId: agent?.id,
  });
}

export interface WebLeadInput {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  interestedProduct?: string;
  /** Evidencia del consentimiento aceptado en el formulario (LOPDP). */
  consent?: {
    text?: string;
    policyVersion?: string;
    ip?: string;
    userAgent?: string;
  };
  /** Atribución first-touch: utm_*, gclid, fbclid, referrer. */
  utm?: Record<string, string>;
}

/** Claves de atribución que se aceptan; el resto se descarta. */
const UTM_KEYS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'fbclid', 'ttclid', 'msclkid', 'referrer',
];

function cleanUtm(utm: Record<string, string> | undefined): Record<string, string> | null {
  if (!utm) return null;
  const out: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = utm[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 200);
  }
  return Object.keys(out).length ? out : null;
}

export interface CapturedWebLead {
  contactId: string;
  conversationId: string;
  text: string;
  optedOut: boolean;
  input: WebLeadInput;
}

/**
 * FASE SÍNCRONA del lead web: crear contacto, identidad de canal y guardar el
 * mensaje. Es lo único que el visitante necesita que ocurra antes de ver
 * "gracias"; todo lo que depende del LLM va después, en segundo plano.
 *
 * El opt-out por palabra clave se queda aquí a propósito: es local, gratis y no
 * puede quedar pendiente de una llamada a la IA que quizá falle.
 */
export async function captureWebLead(opts: WebLeadInput): Promise<CapturedWebLead> {
  const externalId = (opts.email || opts.phone || '').trim().toLowerCase();
  if (!externalId) throw new Error('El formulario requiere email o teléfono.');

  const contact = await findOrCreateContact({
    channel: 'web',
    externalId,
    displayName: opts.name,
    phone: opts.phone,
  });

  // El teléfono se guarda ya normalizado: en formato nacional no se le puede
  // enviar nada ni reconocerlo cuando responda por WhatsApp.
  const e164 = toE164(opts.phone);
  await mergeContactInfo(contact.id, {
    email: opts.email,
    fullName: opts.name,
    phone: e164 ?? opts.phone,
  });

  const conversationId = await getOrCreateConversation(contact.id, 'web');

  const text =
    opts.message?.trim() ||
    `Nuevo contacto desde formulario web.${opts.interestedProduct ? ` Interés: ${opts.interestedProduct}.` : ''}`;

  await saveMessage({
    conversationId,
    contactId: contact.id,
    channel: 'web',
    direction: 'inbound',
    body: text,
  });

  // Identidad del canal por el que se le va a poder escribir. Sin esto el motor
  // de seguimiento nunca alcanzaba al lead web (su identidad era 'web' y las
  // secuencias salen por 'whatsapp').
  const replyChannel = webReplyChannel(opts);
  if (replyChannel) {
    await ensureChannelIdentity({
      contactId: contact.id,
      channel: replyChannel.channel,
      externalId: replyChannel.to,
      handle: opts.name ?? null,
      consentSource: 'web_form',
    });
  }

  // ── EVIDENCIA DE CONSENTIMIENTO Y ATRIBUCIÓN ─────────────────────────────
  // Ante una auditoría LOPDP hay que poder demostrar QUIÉN aceptó, QUÉ texto y
  // CUÁNDO. Antes el checkbox de la landing ni siquiera viajaba en la petición.
  if (opts.consent) {
    const note = JSON.stringify({
      accepted_at: new Date().toISOString(),
      policy_version: opts.consent.policyVersion ?? null,
      text: opts.consent.text ?? null,
      ip: opts.consent.ip ?? null,
      user_agent: opts.consent.userAgent ?? null,
    }).slice(0, 2000);

    await db.from('consents').upsert(
      { contact_id: contact.id, channel: 'web', status: 'opted_in', source: 'web_form', note },
      { onConflict: 'contact_id,channel' },
    );
    await db.from('events').insert({
      contact_id: contact.id,
      type: 'consent_granted',
      payload: { source: 'web_form', policy_version: opts.consent.policyVersion ?? null },
    });
  }

  const utm = cleanUtm(opts.utm);
  if (utm) {
    // Atribución first-touch: no se pisa la de un contacto que ya la tenía.
    const { data: current } = await db.from('contacts').select('metadata').eq('id', contact.id).maybeSingle();
    const metadata = (current?.metadata ?? {}) as Record<string, unknown>;
    if (!metadata.attribution) {
      await db
        .from('contacts')
        .update({ metadata: { ...metadata, attribution: utm } })
        .eq('id', contact.id);
    }
  }

  let optedOut = contact.marketing_opted_out;
  if (isStopWord(text)) {
    await optOutContact(contact.id, 'web', `Lead pidió baja en el formulario: "${text}"`);
    optedOut = true;
  }

  return { contactId: contact.id, conversationId, text, optedOut, input: opts };
}

/** Canal y destino por el que responder a un lead web: WhatsApp si dejó teléfono, si no email. */
function webReplyChannel(opts: WebLeadInput): { channel: Channel; to: string } | null {
  const e164 = toE164(opts.phone);
  if (e164) return { channel: 'whatsapp', to: e164 };
  const email = opts.email?.trim().toLowerCase();
  if (email) return { channel: 'email', to: email };
  return null;
}

/**
 * FASE ASÍNCRONA del lead web: clasificar con IA y responder en el momento —
 * que es cuando la intención de compra está en el pico. Antes el lead web se
 * quedaba mudo: nadie le escribía nunca, ni la IA ni el seguimiento.
 *
 * No lanza: se invoca fire-and-forget desde /capture.
 */
export async function enrichWebLead(captured: CapturedWebLead): Promise<void> {
  try {
    const { contactId, conversationId, text, input } = captured;

    const { data: contact } = await db
      .from('contacts')
      .select('id, display_name, full_name, stage, marketing_opted_out')
      .eq('id', contactId)
      .maybeSingle();
    if (!contact) return;

    const [{ catalog, context }, history] = await Promise.all([getSalesContext(), getHistory(contactId)]);
    const classification = await classifyMessage({
      messageText: text,
      history,
      currentStage: contact.stage,
      productsCatalog: catalog,
    });

    if (!classification.failed) await applyClassification(contactId, classification);

    if (classification.intent === 'pedir_baja') {
      await optOutContact(contactId, 'web', `Lead pidió baja en el formulario: "${text}"`);
      return;
    }
    if (captured.optedOut || contact.marketing_opted_out) return;

    const target = webReplyChannel(input);
    if (!target) return;

    const reply = await generateReply({
      messageText: text,
      history,
      contactName: input.name ?? contact.display_name,
      salesContext: context,
      stage: contact.stage,
    }).catch((err) => {
      console.error('[enrichWebLead] generateReply falló:', err);
      return null as string | null;
    });

    const ackConversationId =
      target.channel === 'web' ? conversationId : await getOrCreateConversation(contactId, target.channel);

    await replyAndSave({
      conversationId: ackConversationId,
      contactId,
      channel: target.channel,
      to: target.to,
      reply,
      senderType: 'ai',
    });
  } catch (err) {
    console.error('[enrichWebLead] fallo procesando el lead web:', err);
  }
}

/**
 * Captura un lead desde formulario web (síncrono de principio a fin).
 * Se conserva para llamadas que necesiten el resultado completo; la landing usa
 * captureWebLead + enrichWebLead para no hacer esperar al visitante.
 */
export async function handleWebLead(opts: WebLeadInput): Promise<{ contactId: string }> {
  const captured = await captureWebLead(opts);
  await enrichWebLead(captured);
  return { contactId: captured.contactId };
}
