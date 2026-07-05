import type { FastifyRequest } from 'fastify';
import type { WebSocket, RawData } from 'ws';
import { llm } from '../ai/router.js';
import { getSalesContext } from '../repo.js';
import { db } from '../db.js';

/**
 * Handler de WebSocket para Twilio ConversationRelay.
 *
 * Protocolo (simplificado): Twilio manda un JSON por cada evento de la llamada.
 * Los que nos interesan tienen `type: 'setup' | 'prompt'`; en 'prompt' viene el
 * texto que dijo el cliente (transcrito por Twilio) en `voicePrompt` (o `text`,
 * para pruebas manuales). Respondemos con `{ type: 'text', token, last: true }`
 * para que Twilio lo convierta a voz.
 */
export function handleCallRelay(socket: WebSocket, req: FastifyRequest): void {
  const query = (req.query ?? {}) as { call_id?: string };
  const callId = query.call_id;

  // Los handlers se enganchan de forma síncrona (requisito de @fastify/websocket)
  // para no perder mensajes mientras se resuelve trabajo async.
  socket.on('message', (raw: RawData) => {
    handleIncomingTurn(socket, callId, raw).catch((err) => {
      req.log.error({ err }, '[calls/relay] error procesando turno');
    });
  });

  socket.on('error', (err) => {
    req.log.error({ err }, '[calls/relay] error de socket');
  });
}

async function handleIncomingTurn(socket: WebSocket, callId: string | undefined, raw: RawData): Promise<void> {
  let msg: { type?: string; voicePrompt?: string; text?: string };
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    return; // mensaje no-JSON, lo ignoramos
  }

  // 'setup' llega al conectar (callSid, from, to...); no requiere respuesta hablada.
  if (msg.type !== 'prompt' && msg.type !== 'text') return;

  const userText = (msg.voicePrompt ?? msg.text ?? '').trim();
  if (!userText) return;

  if (!callId) {
    socket.send(JSON.stringify({
      type: 'text',
      token: 'Disculpa, hubo un problema técnico. Un asesor te contactará pronto.',
      last: true,
    }));
    return;
  }

  try {
    const { context } = await getSalesContext();
    const system = `Eres un vendedor telefónico cordial, claro y breve.
Estás en una llamada de voz en tiempo real: tus respuestas se convierten a audio, así que
escribe SOLO lo que dirías en voz alta (1-3 frases cortas, sin listas, sin markdown, sin emojis).
Nunca inventes precios ni datos que no tengas. Si no sabes algo, ofrece que un asesor lo confirme.
Termina casi siempre invitando a continuar la conversación de forma natural.

Contexto de nuestros productos (uso interno, no lo recites literal):
${context || '(sin productos configurados)'}`;

    const reply = await llm('reply', system, userText, 300);

    await appendTranscriptTurns(callId, [
      { role: 'user', text: userText, at: new Date().toISOString() },
      { role: 'assistant', text: reply, at: new Date().toISOString() },
    ]);

    socket.send(JSON.stringify({ type: 'text', token: reply, last: true }));
  } catch (err) {
    console.error('[calls/relay] error generando respuesta:', err);
    socket.send(JSON.stringify({
      type: 'text',
      token: 'Disculpa, ¿puedes repetir eso?',
      last: true,
    }));
  }
}

/** Agrega turnos al transcript (jsonb array) de la llamada: lee, concatena, actualiza. */
async function appendTranscriptTurns(
  callId: string,
  turns: Array<{ role: 'user' | 'assistant'; text: string; at: string }>,
): Promise<void> {
  const { data } = await db.from('calls').select('transcript').eq('id', callId).single();
  const current = Array.isArray(data?.transcript) ? data!.transcript : [];
  await db.from('calls').update({ transcript: [...current, ...turns] }).eq('id', callId);
}
