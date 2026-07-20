import { llm } from './router.js';

export interface Classification {
  stage: 'new' | 'engaged' | 'qualified' | 'negotiating' | 'customer' | 'lost';
  interest_level: 'low' | 'medium' | 'high';
  lead_score: number;
  intent: string;
  interested_product: string | null;
  summary: string;
  /**
   * true cuando la clasificacion es el relleno neutro que se devuelve al fallar
   * el LLM. Quien la consuma NO debe persistirla: sobrescribiria el CRM con
   * stage='new'/score=0 a clientes ya calificados cada vez que caiga el proveedor.
   */
  failed?: boolean;
}

export async function classifyMessage(opts: {
  messageText: string;
  history?: string;
  productsCatalog?: string;
  /** Etapa actual del contacto, para que el modelo no la degrade sin motivo. */
  currentStage?: string;
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
No agregues texto fuera del JSON.

Reglas de etapa: el historial manda sobre el mensaje suelto. Un mensaje corto o de
cortesia ("ok", "gracias", "listo") de un cliente que ya venia avanzado NO baja su
etapa: mantiene la etapa actual. Solo retrocede si el cliente dice explicitamente
que ya no quiere o que compro en otro lado.`;

  const user = `Catalogo de productos disponibles: ${opts.productsCatalog ?? 'no especificado'}

Etapa actual del contacto: ${opts.currentStage ?? 'desconocida'}

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
    console.error('[classify] fallo, devuelvo clasificacion neutra (no persistible):', err);
    return {
      stage: 'new',
      interest_level: 'low',
      lead_score: 0,
      intent: 'desconocido',
      interested_product: null,
      summary: '',
      failed: true,
    };
  }
}
