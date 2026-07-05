import { db } from '../db.js';
import { llm } from '../ai/router.js';
import { applyClassification } from '../repo.js';

/** Body del webhook de estado de Twilio (application/x-www-form-urlencoded). */
export interface TwilioStatusBody {
  CallSid?: string;
  CallStatus?: string;
  CallDuration?: string;
  [key: string]: unknown;
}

const VALID_STATUSES = new Set([
  'queued', 'ringing', 'in-progress', 'completed', 'failed', 'no-answer', 'busy', 'canceled',
]);

const FINAL_STATUSES = new Set(['completed', 'failed', 'no-answer', 'busy', 'canceled']);

/**
 * Procesa el webhook de estado de una llamada (StatusCallback de Twilio):
 * actualiza la fila de `calls` y, si terminó ('completed'), genera un resumen
 * con IA y aplica la clasificación al contacto asociado.
 */
export async function handleCallStatus(body: TwilioStatusBody): Promise<void> {
  const sid = body.CallSid;
  if (!sid) return;

  const rawStatus = typeof body.CallStatus === 'string' ? body.CallStatus : undefined;
  const status = rawStatus && VALID_STATUSES.has(rawStatus) ? rawStatus : undefined;
  const durationSeconds = body.CallDuration != null ? Number(body.CallDuration) : undefined;

  const patch: Record<string, unknown> = {};
  if (status) patch.status = status;
  if (durationSeconds !== undefined && !Number.isNaN(durationSeconds)) patch.duration_seconds = durationSeconds;
  if (status && FINAL_STATUSES.has(status)) patch.ended_at = new Date().toISOString();

  if (Object.keys(patch).length === 0) return;

  const { data: call, error } = await db
    .from('calls')
    .update(patch)
    .eq('twilio_call_sid', sid)
    .select('id, contact_id, transcript')
    .maybeSingle();

  if (error || !call) {
    console.warn(`[calls/status] no se encontró la llamada con SID ${sid}:`, error?.message);
    return;
  }

  if (status === 'completed' && call.contact_id) {
    await summarizeAndClassify(call.id, call.contact_id, call.transcript);
  }
}

/** Genera un resumen de la llamada con IA y lo aplica al contacto (stage, score, etc). */
async function summarizeAndClassify(callId: string, contactId: string, transcript: unknown): Promise<void> {
  try {
    const transcriptText = Array.isArray(transcript)
      ? transcript
          .map((t) => `${(t as { role?: string }).role === 'user' ? 'Cliente' : 'Vendedor'}: ${(t as { text?: string }).text ?? ''}`)
          .join('\n')
      : '';

    const system = `Eres un analista de ventas. Analizas la transcripción de una llamada telefónica de ventas.
Devuelve SIEMPRE y SOLO un objeto JSON válido con estas claves exactas:
- stage: uno de ["new","engaged","qualified","negotiating","customer","lost"]
- interest_level: uno de ["low","medium","high"]
- lead_score: numero entero 0-100 (probabilidad de compra)
- summary: resumen de 2-3 frases de la llamada y su resultado
No agregues texto fuera del JSON.`;

    const user = `Transcripción de la llamada:\n${transcriptText || '(sin transcripción disponible)'}`;

    const text = await llm('classify', system, user, 400);
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const parsed = JSON.parse(json) as {
      stage: string; interest_level: string; lead_score: number; summary: string;
    };

    await db.from('calls').update({ summary: parsed.summary, outcome: parsed.stage }).eq('id', callId);
    await applyClassification(contactId, parsed);
  } catch (err) {
    console.error('[calls/status] error resumiendo/clasificando la llamada:', err);
  }
}
