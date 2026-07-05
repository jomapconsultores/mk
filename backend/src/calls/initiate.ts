import { db } from '../db.js';
import { createOutboundCall } from './twilio.js';

/**
 * Construye las URLs que necesita el flujo de Twilio para una llamada dada:
 *  - twimlUrl: la URL que Twilio consulta al conectar la llamada (webhook, http/https)
 *  - relayUrl: el WebSocket de ConversationRelay al que ese TwiML apunta (wss)
 *
 * Se derivan de PUBLIC_BACKEND_URL (ya configurada en producción, ver docs/coolify-deploy.md).
 */
export function buildCallUrls(callId: string): { twimlUrl: string; relayUrl: string; statusCallbackUrl: string } {
  const backendUrl = (process.env.PUBLIC_BACKEND_URL ?? '').replace(/\/+$/, '');
  if (!backendUrl) {
    throw new Error('Falta la variable de entorno PUBLIC_BACKEND_URL (URL pública del backend).');
  }
  const wsBase = backendUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
  return {
    twimlUrl: `${backendUrl}/calls/twiml?call_id=${callId}`,
    relayUrl: `${wsBase}/calls/relay?call_id=${callId}`,
    statusCallbackUrl: `${backendUrl}/calls/status?call_id=${callId}`,
  };
}

/**
 * Inicia una llamada saliente con IA para un contacto existente:
 * 1. Busca su teléfono.
 * 2. Crea la fila en `calls` (status 'queued').
 * 3. Dispara la llamada en Twilio (ConversationRelay atenderá la conversación).
 * 4. Guarda el SID devuelto por Twilio.
 */
export async function initiateCall(contactId: string): Promise<{ callId: string; twilioCallSid: string }> {
  const { data: contact, error: contactErr } = await db
    .from('contacts')
    .select('id, phone')
    .eq('id', contactId)
    .single();

  if (contactErr || !contact) {
    throw new Error(`Contacto no encontrado: ${contactErr?.message ?? contactId}`);
  }
  if (!contact.phone) {
    throw new Error('El contacto no tiene número de teléfono registrado.');
  }

  const { data: call, error: insertErr } = await db
    .from('calls')
    .insert({ contact_id: contactId, phone: contact.phone, status: 'queued' })
    .select('id')
    .single();

  if (insertErr || !call) {
    throw new Error(`No se pudo crear el registro de llamada: ${insertErr?.message ?? 'respuesta vacía'}`);
  }

  try {
    const { twimlUrl, statusCallbackUrl } = buildCallUrls(call.id);

    const twilioCall = await createOutboundCall({ to: contact.phone, twimlUrl, statusCallbackUrl });

    const { error: updateErr } = await db
      .from('calls')
      .update({ twilio_call_sid: twilioCall.sid })
      .eq('id', call.id);

    if (updateErr) {
      throw new Error(`Llamada creada en Twilio (sid=${twilioCall.sid}) pero no se pudo guardar en la BD: ${updateErr.message}`);
    }

    return { callId: call.id, twilioCallSid: twilioCall.sid };
  } catch (err) {
    // La llamada nunca llegó a tener SID (o no se pudo guardar) — no quedará huérfana en 'queued'.
    await db.from('calls').update({ status: 'failed' }).eq('id', call.id);
    throw err;
  }
}
