import { db } from '../db.js';
import { writeOutreachMessage } from './writer.js';
import { sendEmail } from '../channels/email.js';
import { sendWhatsAppText } from '../channels/whatsapp.js';

/**
 * Motor de prospección activa.
 * Igual que el engine de secuencias pero para prospectos fríos:
 *   1. enrollEligibleProspects()  — inscribe prospectos calificados en campañas activas
 *   2. processDueEnrollments()    — envía los mensajes cuyo delay ya venció
 */
export async function runProspectingOnce(): Promise<{ enrolled: number; sent: number }> {
  const enrolled = await enrollEligibleProspects();
  const sent     = await processDueEnrollments();
  return { enrolled, sent };
}

// ---------------------------------------------------------------------------
// Inscribir prospectos elegibles en campañas activas
// ---------------------------------------------------------------------------
async function enrollEligibleProspects(): Promise<number> {
  const { data: campaigns } = await db
    .from('outreach_campaigns')
    .select('*')
    .eq('is_active', true);

  let totalEnrolled = 0;

  for (const campaign of campaigns ?? []) {
    const filter = (campaign.target_filter ?? {}) as Record<string, unknown>;

    // Contar cuántos ya fueron enrolados hoy para respetar daily_limit
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { count: todayCount } = await db
      .from('outreach_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .gte('enrolled_at', today.toISOString());

    const remaining = (campaign.daily_limit ?? 20) - (todayCount ?? 0);
    if (remaining <= 0) continue;

    // Buscar prospectos elegibles no inscriptos aún
    let q = db
      .from('prospects')
      .select('id')
      .eq('status', 'qualified')
      .limit(remaining);

    if (filter.fit_score_min) q = q.gte('fit_score', filter.fit_score_min);
    if (filter.industry)       q = q.ilike('industry', `%${filter.industry}%`);
    if (filter.location)       q = q.ilike('location', `%${filter.location}%`);

    const { data: prospects } = await q;
    const prospectIds = (prospects ?? []).map((p) => p.id);

    // Primer paso de la campaña: no depende de cada prospecto, se calcula una sola vez.
    const { data: firstStep } = await db
      .from('outreach_steps')
      .select('delay_hours')
      .eq('campaign_id', campaign.id)
      .order('step_order')
      .limit(1)
      .single();

    // ¿Cuáles de estos prospectos ya están inscritos en esta campaña? (una sola consulta)
    let alreadyEnrolled = new Set<string>();
    if (prospectIds.length > 0) {
      const { data: existing } = await db
        .from('outreach_enrollments')
        .select('prospect_id')
        .eq('campaign_id', campaign.id)
        .in('prospect_id', prospectIds);
      alreadyEnrolled = new Set((existing ?? []).map((e) => e.prospect_id));
    }

    for (const p of prospects ?? []) {
      // ¿Ya está inscrito en esta campaña?
      if (alreadyEnrolled.has(p.id)) continue;

      const nextRun = new Date();
      nextRun.setHours(nextRun.getHours() + (firstStep?.delay_hours ?? 0));

      await db.from('outreach_enrollments').insert({
        campaign_id: campaign.id,
        prospect_id: p.id,
        status:      'active',
        current_step: 1,
        next_run_at: nextRun.toISOString(),
      });

      await db.from('prospects').update({ status: 'outreach' }).eq('id', p.id);
      totalEnrolled++;
    }
  }

  return totalEnrolled;
}

// ---------------------------------------------------------------------------
// Procesar envíos pendientes
// ---------------------------------------------------------------------------
async function processDueEnrollments(): Promise<number> {
  const now = new Date().toISOString();

  const { data: due } = await db
    .from('outreach_enrollments')
    .select('*, outreach_campaigns(*)')
    .eq('status', 'active')
    .lte('next_run_at', now)
    .limit(30);

  let sent = 0;

  for (const enrollment of due ?? []) {
    try {
      sent += await processOneEnrollment(enrollment) ? 1 : 0;
    } catch (err) {
      console.error(`[prospecting-engine] error en enrollment ${enrollment.id}:`, err);
      await db.from('outreach_enrollments').update({ status: 'failed' }).eq('id', enrollment.id);
    }
  }

  return sent;
}

async function processOneEnrollment(enrollment: Record<string, unknown>): Promise<boolean> {
  const campaignId = enrollment.campaign_id as string;
  const prospectId = enrollment.prospect_id as string;
  const stepOrder  = enrollment.current_step as number;
  const campaign   = enrollment.outreach_campaigns as Record<string, unknown>;

  // Verificar horario de envío
  const hour = new Date().getHours();
  const startH = (campaign?.send_hour_start as number) ?? 9;
  const endH   = (campaign?.send_hour_end   as number) ?? 18;
  if (hour < startH || hour >= endH) return false;

  // Obtener paso actual
  const { data: step } = await db
    .from('outreach_steps')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('step_order', stepOrder)
    .maybeSingle();

  if (!step) {
    // Campaña terminada
    await db.from('outreach_enrollments').update({ status: 'completed' }).eq('id', enrollment.id as string);
    return false;
  }

  // Obtener datos del prospecto
  const { data: prospect } = await db
    .from('prospects')
    .select('*, products(name, sales_brief)')
    .eq('id', prospectId)
    .single();

  if (!prospect || prospect.status === 'discarded') {
    await db.from('outreach_enrollments').update({ status: 'stopped' }).eq('id', enrollment.id as string);
    return false;
  }

  // Determinar canal: prioriza el que la IA recomienda para este prospecto
  const campaignChannels = (campaign?.channel_order as string[]) ?? ['email', 'whatsapp'];
  const preferredChannel = prospect.best_channel && (prospect.email || prospect.phone)
    ? [prospect.best_channel, ...campaignChannels.filter((c: string) => c !== prospect.best_channel)]
    : campaignChannels;
  const channel = pickChannel(prospect, preferredChannel);
  if (!channel) {
    console.warn(`[prospecting-engine] sin canal disponible para prospecto ${prospectId}`);
    await db.from('outreach_enrollments').update({ status: 'stopped' }).eq('id', enrollment.id as string);
    return false;
  }

  // Redactar mensaje con IA
  const productContext = prospect.products
    ? `${prospect.products.name}: ${prospect.products.sales_brief ?? ''}`
    : undefined;

  // En el paso 1, enriquecer la instrucción con el icebreaker generado al calificar
  const basePrompt = step.ai_prompt ?? step.message_template ?? '';
  const enrichedPrompt = (stepOrder === 1 && prospect.icebreaker)
    ? `${basePrompt}\n\nRompe el hielo con esta frase adaptada: "${prospect.icebreaker}"`
    : basePrompt;

  const { subject, body } = await writeOutreachMessage({
    channel,
    intent:   step.message_intent,
    aiPrompt: enrichedPrompt,
    prospect: {
      full_name:      prospect.full_name,
      company:        prospect.company,
      industry:       prospect.industry,
      location:       prospect.location,
      main_pain:      prospect.main_pain,
      outreach_angle: prospect.outreach_angle,
    },
    productContext,
    psychContext: {
      disc:          prospect.disc_estimate,
      awareness:     prospect.awareness_level,
      emotional_hook: prospect.emotional_hook,
    },
  });

  // Enviar
  await sendViaChannel(channel, prospect, subject, body);

  // Registrar
  await db.from('outreach_messages').insert({
    enrollment_id: enrollment.id,
    prospect_id:   prospectId,
    step_order:    stepOrder,
    channel,
    body,
    status: 'sent',
  });

  // Avanzar al siguiente paso
  const { data: nextStep } = await db
    .from('outreach_steps')
    .select('step_order, delay_hours')
    .eq('campaign_id', campaignId)
    .eq('step_order', stepOrder + 1)
    .maybeSingle();

  if (nextStep) {
    const nextRun = new Date();
    nextRun.setHours(nextRun.getHours() + nextStep.delay_hours);
    await db.from('outreach_enrollments').update({
      current_step: nextStep.step_order,
      channel_used: channel,
      next_run_at:  nextRun.toISOString(),
    }).eq('id', enrollment.id as string);
  } else {
    await db.from('outreach_enrollments').update({
      status:       'completed',
      channel_used: channel,
    }).eq('id', enrollment.id as string);
  }

  return true;
}

function pickChannel(prospect: Record<string, unknown>, order: string[]): string | null {
  for (const ch of order) {
    if (ch === 'email'    && prospect.email)  return 'email';
    if (ch === 'whatsapp' && prospect.phone)  return 'whatsapp';
  }
  return null;
}

async function sendViaChannel(
  channel: string,
  prospect: Record<string, unknown>,
  subject: string | undefined,
  body: string,
): Promise<void> {
  if (channel === 'email' && prospect.email) {
    await sendEmail({ to: prospect.email as string, subject: subject ?? 'Hola', text: body });
  } else if (channel === 'whatsapp' && prospect.phone) {
    await sendWhatsAppText(prospect.phone as string, body);
  }
}

/**
 * Convierte un prospecto en contacto cuando responde.
 * Llamar desde el orchestrator cuando llega un mensaje de un número en prospects.
 */
export async function convertProspectToContact(phone: string, contactId: string): Promise<void> {
  const { data: prospect } = await db
    .from('prospects')
    .select('id')
    .eq('phone', phone)
    .in('status', ['outreach', 'qualified'])
    .maybeSingle();

  if (!prospect) return;

  const now = new Date().toISOString();
  await db.from('prospects').update({
    status:       'converted',
    contact_id:   contactId,
    responded_at: now,
    converted_at: now,
  }).eq('id', prospect.id);

  await db.from('outreach_enrollments').update({
    status:       'converted',
    responded_at: now,
    converted_at: now,
  }).eq('prospect_id', prospect.id).eq('status', 'active');
}
