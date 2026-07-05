import { db } from '../db.js';
import { sendByChannel } from '../channels/send.js';
import {
  getChannelIdentity,
  getSalesContext,
  hasInboundSince,
  saveMessage,
  type Channel,
} from '../repo.js';
import { renderStepMessage } from './render.js';

// Horario permitido para enviar (hora local del servidor). Fuera de esto, se pospone.
const QUIET_START = 21; // 9 pm
const QUIET_END = 9; //    9 am

function isQuietHour(d: Date): boolean {
  const h = d.getHours();
  return h >= QUIET_START || h < QUIET_END;
}

/** Devuelve la fecha del proximo horario habil (hoy 9am o manana 9am). */
function nextBusinessTime(from: Date): Date {
  const d = new Date(from);
  if (d.getHours() >= QUIET_START) {
    d.setDate(d.getDate() + 1);
  }
  d.setHours(QUIET_END, 0, 0, 0);
  return d;
}

interface SequenceRow {
  id: string;
  channel: Channel | null;
  trigger: Record<string, unknown>;
}

interface StepRow {
  step_order: number;
  delay_hours: number;
  message_template: string | null;
  ai_prompt: string | null;
  send_condition: Record<string, unknown>;
}

/**
 * 1) INSCRIPCION: busca contactos que cumplen el disparador de cada secuencia activa
 *    y los inscribe (si no lo estaban ya). next_run_at = ahora + delay del paso 1.
 */
export async function enrollEligibleContacts(): Promise<number> {
  const { data: sequences } = await db
    .from('sequences')
    .select('id, channel, trigger')
    .eq('is_active', true);

  let enrolled = 0;
  for (const seq of (sequences ?? []) as SequenceRow[]) {
    const trigger = seq.trigger ?? {};

    // Construye el filtro de contactos a partir del trigger (p.ej. {"stage":"new"}).
    let query = db.from('contacts').select('id').eq('marketing_opted_out', false);
    if (typeof trigger.stage === 'string') query = query.eq('stage', trigger.stage);
    if (typeof trigger.interest_level === 'string') query = query.eq('interest_level', trigger.interest_level);
    if (typeof trigger.min_score === 'number') query = query.gte('lead_score', trigger.min_score);

    const { data: candidates } = await query.limit(500);

    // Primer paso de la secuencia para calcular la primera espera.
    const { data: firstStep } = await db
      .from('sequence_steps')
      .select('delay_hours')
      .eq('sequence_id', seq.id)
      .order('step_order', { ascending: true })
      .limit(1)
      .maybeSingle();
    const firstDelay = firstStep?.delay_hours ?? 0;

    if ((candidates ?? []).length > 0) {
      const nextRun = new Date(Date.now() + firstDelay * 3600_000).toISOString();
      const rows = (candidates ?? []).map((c) => ({
        sequence_id: seq.id,
        contact_id: c.id,
        next_run_at: nextRun,
      }));
      const { data: inserted } = await db
        .from('sequence_enrollments')
        .upsert(rows, { onConflict: 'sequence_id,contact_id', ignoreDuplicates: true })
        // si ya estaba inscrito (unique), no hace nada (ignoreDuplicates las omite)
        .select('id');
      enrolled += inserted?.length ?? 0;
    }
  }
  return enrolled;
}

/**
 * 2) EJECUCION: procesa las inscripciones cuyo next_run_at ya venció.
 *    Respeta opt-out, condiciones del paso, horario y avanza al siguiente paso.
 */
export async function processDueEnrollments(): Promise<number> {
  const nowIso = new Date().toISOString();
  const { data: due } = await db
    .from('sequence_enrollments')
    .select('id, sequence_id, contact_id, current_step, enrolled_at')
    .eq('status', 'active')
    .lte('next_run_at', nowIso)
    .limit(200);

  let sent = 0;
  for (const enr of due ?? []) {
    try {
      sent += (await processOneEnrollment(enr)) ? 1 : 0;
    } catch (err) {
      console.error(`[engine] error en enrollment ${enr.id}:`, err);
      await db.from('sequence_enrollments').update({ status: 'failed' }).eq('id', enr.id);
    }
  }
  return sent;
}

async function processOneEnrollment(enr: {
  id: string;
  sequence_id: string;
  contact_id: string;
  current_step: number;
}): Promise<boolean> {
  // Datos de la secuencia y del contacto (independientes, se piden en paralelo)
  const [{ data: seq }, { data: contact }] = await Promise.all([
    db
      .from('sequences')
      .select('channel')
      .eq('id', enr.sequence_id)
      .single(),
    db
      .from('contacts')
      .select('id, display_name, marketing_opted_out, interested_product_id')
      .eq('id', enr.contact_id)
      .single(),
  ]);

  // Si se dio de baja, detener.
  if (!contact || contact.marketing_opted_out) {
    await db.from('sequence_enrollments').update({ status: 'stopped' }).eq('id', enr.id);
    return false;
  }

  // El paso a enviar es current_step + 1
  const targetOrder = enr.current_step + 1;
  const { data: step } = (await db
    .from('sequence_steps')
    .select('step_order, delay_hours, message_template, ai_prompt, send_condition')
    .eq('sequence_id', enr.sequence_id)
    .eq('step_order', targetOrder)
    .maybeSingle()) as { data: StepRow | null };

  // No hay mas pasos -> secuencia completada.
  if (!step) {
    await db
      .from('sequence_enrollments')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', enr.id);
    return false;
  }

  // Condicion: "enviar solo si NO respondio desde el ultimo contacto".
  // Si el cliente ya respondio, consideramos el objetivo logrado -> detener secuencia.
  if (step.send_condition?.no_reply_since_last_step === true) {
    const { data: lastOut } = await db
      .from('messages')
      .select('created_at')
      .eq('contact_id', enr.contact_id)
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const since = lastOut?.created_at ?? new Date(0).toISOString();
    if (await hasInboundSince(enr.contact_id, since)) {
      await db.from('sequence_enrollments').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', enr.id);
      return false;
    }
  }

  // Horario: si estamos en horas de silencio, posponer.
  const now = new Date();
  if (isQuietHour(now)) {
    await db
      .from('sequence_enrollments')
      .update({ next_run_at: nextBusinessTime(now).toISOString() })
      .eq('id', enr.id);
    return false;
  }

  const channel: Channel = (seq?.channel as Channel) ?? 'whatsapp';
  const to = await getChannelIdentity(enr.contact_id, channel);
  if (!to) {
    // No tenemos como contactarlo por ese canal: completar para no reintentar siempre.
    await db.from('sequence_enrollments').update({ status: 'completed', completed_at: now.toISOString() }).eq('id', enr.id);
    return false;
  }

  // Producto de interes (para personalizar)
  let productName: string | null = null;
  if (contact.interested_product_id) {
    const { data: p } = await db.from('products').select('name').eq('id', contact.interested_product_id).maybeSingle();
    productName = p?.name ?? null;
  }
  const { context } = await getSalesContext();

  // Redactar y enviar
  const body = await renderStepMessage({
    template: step.message_template,
    aiPrompt: step.ai_prompt,
    ctx: { contactName: contact.display_name, productName, salesContext: context },
  });

  if (body) {
    const conversationId = await getOrCreateConv(enr.contact_id, channel);
    await sendByChannel(channel, to, body);
    await saveMessage({
      conversationId,
      contactId: enr.contact_id,
      channel,
      direction: 'outbound',
      body,
      senderType: 'sequence',
    });
    await db.from('events').insert({
      contact_id: enr.contact_id,
      type: 'sequence_sent',
      payload: { sequence_id: enr.sequence_id, step_order: targetOrder },
    });
  }

  // Avanzar: ver si hay un paso siguiente para programar la proxima espera.
  const { data: nextStep } = await db
    .from('sequence_steps')
    .select('delay_hours')
    .eq('sequence_id', enr.sequence_id)
    .eq('step_order', targetOrder + 1)
    .maybeSingle();

  if (nextStep) {
    const nextRun = new Date(Date.now() + (nextStep.delay_hours ?? 24) * 3600_000).toISOString();
    await db
      .from('sequence_enrollments')
      .update({ current_step: targetOrder, next_run_at: nextRun })
      .eq('id', enr.id);
  } else {
    await db
      .from('sequence_enrollments')
      .update({ current_step: targetOrder, status: 'completed', completed_at: now.toISOString() })
      .eq('id', enr.id);
  }

  return true;
}

/** Helper local: conversacion abierta para registrar el mensaje del seguimiento. */
async function getOrCreateConv(contactId: string, channel: Channel): Promise<string> {
  const { data: existing } = await db
    .from('conversations')
    .select('id')
    .eq('contact_id', contactId)
    .eq('channel', channel)
    .eq('status', 'open')
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data } = await db
    .from('conversations')
    .insert({ contact_id: contactId, channel })
    .select('id')
    .single();
  return data!.id;
}

/** Una pasada completa del motor: inscribir + procesar. */
export async function runEngineOnce(): Promise<{ enrolled: number; sent: number }> {
  const enrolled = await enrollEligibleContacts();
  const sent = await processDueEnrollments();
  return { enrolled, sent };
}
