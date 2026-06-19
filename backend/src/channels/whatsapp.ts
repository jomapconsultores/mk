import { config } from '../config.js';

const GRAPH = 'https://graph.facebook.com/v21.0';

/** Envia un mensaje de texto por WhatsApp Cloud API. */
export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  if (!config.whatsapp.token || !config.whatsapp.phoneId) {
    console.warn('[whatsapp] sin credenciales, no se envia. Mensaje:', { to, body });
    return;
  }

  const res = await fetch(`${GRAPH}/${config.whatsapp.phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.whatsapp.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp send fallo (${res.status}): ${err}`);
  }
}

/** Forma de un mensaje entrante ya normalizado desde el webhook de Meta. */
export interface IncomingWhatsApp {
  from: string;        // numero del cliente (external_id)
  name?: string;       // nombre de perfil
  text: string;        // contenido
  messageId: string;   // id del mensaje en Meta
}

/**
 * Extrae los mensajes de texto entrantes del payload del webhook de Meta.
 * Meta puede enviar varios cambios/mensajes por request.
 */
export function parseWhatsAppWebhook(payload: any): IncomingWhatsApp[] {
  const out: IncomingWhatsApp[] = [];
  const entries = payload?.entry ?? [];
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const contacts = value.contacts ?? [];
      const profileName = contacts[0]?.profile?.name;
      for (const msg of value.messages ?? []) {
        if (msg.type === 'text') {
          out.push({
            from: msg.from,
            name: profileName,
            text: msg.text?.body ?? '',
            messageId: msg.id,
          });
        }
      }
    }
  }
  return out;
}
