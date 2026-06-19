import type { Channel } from '../repo.js';
import { sendWhatsAppText } from './whatsapp.js';

/**
 * Envia un mensaje de texto por el canal correspondiente.
 * Punto unico de salida: aqui se van sumando los demas canales.
 */
export async function sendByChannel(channel: Channel, to: string, body: string): Promise<void> {
  switch (channel) {
    case 'whatsapp':
      return sendWhatsAppText(to, body);
    // TODO Fase 2: instagram, facebook, email
    default:
      console.warn(`[send] canal ${channel} aun no implementado para envio.`);
  }
}
