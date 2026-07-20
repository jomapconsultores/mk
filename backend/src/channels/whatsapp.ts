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
    // Sin timeout, una Graph API que no responde deja colgado al worker de
    // secuencias y al webhook entrante.
    signal: AbortSignal.timeout(10_000),
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
  text: string;        // contenido (o descripcion, si no es texto)
  messageId: string;   // id del mensaje en Meta
  /** Tipo original de Meta: 'text', 'audio', 'image', 'interactive'... */
  type: string;
  /** true si NO es texto: nota de voz, foto, documento, ubicacion, boton. */
  isMedia: boolean;
}

/**
 * Convierte un mensaje que no es texto en algo que el CRM pueda guardar y
 * mostrar. En Ecuador la nota de voz es un primer contacto habitual y la foto
 * de producto es intencion de compra clarisima: descartarlos era tirar el lead
 * entero antes incluso de crear el contacto.
 */
function describeNonText(msg: any): string | null {
  switch (msg.type) {
    case 'audio':    return '🎤 [Nota de voz recibida — escúchala en WhatsApp]';
    case 'voice':    return '🎤 [Nota de voz recibida — escúchala en WhatsApp]';
    case 'image':    return `📷 [Imagen recibida]${msg.image?.caption ? ` ${msg.image.caption}` : ''}`;
    case 'video':    return `🎬 [Video recibido]${msg.video?.caption ? ` ${msg.video.caption}` : ''}`;
    case 'document': return `📎 [Documento recibido${msg.document?.filename ? `: ${msg.document.filename}` : ''}]`;
    case 'sticker':  return '🙂 [Sticker recibido]';
    case 'location': return `📍 [Ubicación recibida${msg.location?.name ? `: ${msg.location.name}` : ''}]`;
    case 'contacts': return '👤 [Contacto compartido]';
    case 'button':   return msg.button?.text ?? '[Botón pulsado]';
    case 'interactive':
      return (
        msg.interactive?.button_reply?.title ??
        msg.interactive?.list_reply?.title ??
        '[Respuesta a menú]'
      );
    default:
      return null;
  }
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
            type: 'text',
            isMedia: false,
          });
          continue;
        }
        // Los botones y respuestas de menú son texto a efectos de conversación.
        const interactive = msg.type === 'button' || msg.type === 'interactive';
        const described = describeNonText(msg);
        if (described) {
          out.push({
            from: msg.from,
            name: profileName,
            text: described,
            messageId: msg.id,
            type: msg.type,
            isMedia: !interactive,
          });
        }
      }
    }
  }
  return out;
}
