import { anthropic, AI_MODEL } from './anthropic.js';

/**
 * Genera una respuesta conversacional para "convencer" al cliente, con tono cercano,
 * basada en el catalogo y el historial. Nunca inventa precios que no esten en el brief.
 */
export async function generateReply(opts: {
  messageText: string;
  history?: string;
  contactName?: string | null;
  salesContext: string;   // briefs de venta de productos relevantes
}): Promise<string> {
  const system = `Eres un asesor de ventas amable, honesto y cercano (tono latinoamericano, tuteo).
Tu objetivo es ayudar al cliente y guiarlo a comprar, SIN presionar ni mentir.
Reglas:
- Responde corto y natural, como en un chat (1-4 frases).
- Usa solo la informacion del contexto de ventas. Si no sabes un dato (precio, stock),
  dilo y ofrece que un asesor humano lo confirme. NUNCA inventes precios.
- Si el cliente muestra intencion de compra, propon el siguiente paso concreto.
- Si el cliente pide dejar de recibir mensajes, confirma amablemente que sera dado de baja.
- Escribe en el idioma del cliente.`;

  const user = `Cliente: ${opts.contactName ?? 'desconocido'}

Contexto de ventas (productos):
${opts.salesContext || '(sin contexto)'}

Historial reciente:
${opts.history ?? '(sin historial)'}

Mensaje del cliente:
"""${opts.messageText}"""

Escribe SOLO el texto de tu respuesta al cliente.`;

  const res = await anthropic.messages.create({
    model: AI_MODEL,
    max_tokens: 400,
    system,
    messages: [{ role: 'user', content: user }],
  });

  return res.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text: string }).text)
    .join('')
    .trim();
}
