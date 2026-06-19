import type Anthropic from '@anthropic-ai/sdk';
import { anthropic, AI_MODEL } from './anthropic.js';

export interface Classification {
  stage: 'new' | 'engaged' | 'qualified' | 'negotiating' | 'customer' | 'lost';
  interest_level: 'low' | 'medium' | 'high';
  lead_score: number;            // 0-100
  intent: string;                // p.ej. 'pregunta_precio', 'quiere_comprar', 'pedir_baja'
  interested_product: string | null;
  summary: string;               // resumen breve del cliente
}

/**
 * Clasifica un mensaje entrante usando Claude. Devuelve etapa, interés, score e intención.
 * Es robusto: si la IA falla, devuelve una clasificación neutra para no romper el flujo.
 */
export async function classifyMessage(opts: {
  messageText: string;
  history?: string;          // historial reciente de la conversación (opcional)
  productsCatalog?: string;  // nombres de productos para que detecte el de interés
}): Promise<Classification> {
  const system = `Eres un analista de ventas. Clasificas mensajes de clientes potenciales.
Devuelve SIEMPRE y SOLO un objeto JSON valido con estas claves exactas:
- stage: uno de ["new","engaged","qualified","negotiating","customer","lost"]
- interest_level: uno de ["low","medium","high"]
- lead_score: numero entero 0-100 (probabilidad de compra)
- intent: etiqueta corta en snake_case del objetivo del mensaje. Usa "pedir_baja" si el cliente
  pide dejar de recibir mensajes, dice STOP, "no me interesa", "no escriban", "darme de baja".
- interested_product: nombre del producto que le interesa, o null
- summary: resumen de 1 frase del cliente y su necesidad
No agregues texto fuera del JSON.`;

  const user = `Catalogo de productos disponibles: ${opts.productsCatalog ?? 'no especificado'}

Historial reciente:
${opts.history ?? '(sin historial)'}

Mensaje nuevo del cliente:
"""${opts.messageText}"""`;

  try {
    const res = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 512,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    // Extrae el primer bloque JSON aunque venga con texto alrededor.
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const parsed = JSON.parse(json) as Classification;

    // Saneamiento mínimo
    parsed.lead_score = Math.max(0, Math.min(100, Math.round(parsed.lead_score ?? 0)));
    return parsed;
  } catch (err) {
    console.error('[classify] fallo, devuelvo clasificacion neutra:', err);
    return {
      stage: 'new',
      interest_level: 'low',
      lead_score: 0,
      intent: 'desconocido',
      interested_product: null,
      summary: '',
    };
  }
}
