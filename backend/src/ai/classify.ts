import { llm } from './router.js';

export interface Classification {
  stage: 'new' | 'engaged' | 'qualified' | 'negotiating' | 'customer' | 'lost';
  interest_level: 'low' | 'medium' | 'high';
  lead_score: number;
  intent: string;
  interested_product: string | null;
  summary: string;
}

export async function classifyMessage(opts: {
  messageText: string;
  history?: string;
  productsCatalog?: string;
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
    const text = await llm('classify', system, user, 512);

    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const parsed = JSON.parse(json) as Classification;
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
