import type { Channel } from '../repo.js';
import { sendWhatsAppText } from './whatsapp.js';
import { sendEmail } from './email.js';

/**
 * Envia un mensaje de texto por el canal correspondiente.
 * Punto unico de salida: aqui se van sumando los demas canales.
 */
export async function sendByChannel(
  channel: Channel,
  to: string,
  body: string,
  opts?: { subject?: string },
): Promise<void> {
  switch (channel) {
    case 'whatsapp':
      return sendWhatsAppText(to, body);
    case 'email':
      return sendEmail({ to, subject: opts?.subject ?? 'Sobre tu consulta', text: body });
    // TODO Fase 2: instagram, facebook, sms
    default:
      // Antes esto era un console.warn: el envío "funcionaba" sin enviar nada,
      // así que la secuencia consumía pasos y se marcaba como completada. Ahora
      // falla de forma visible para que quien llame decida (reintento, otro
      // canal o marcar la inscripción como fallida).
      throw new Error(`[send] canal ${channel} no soportado para envío`);
  }
}
