import { anthropic, AI_MODEL } from '../ai/anthropic.js';

export interface RenderContext {
  contactName?: string | null;
  productName?: string | null;
  salesContext?: string;
}

/** Reemplaza variables tipo {{nombre}} en una plantilla fija. */
export function renderTemplate(template: string, ctx: RenderContext): string {
  return template
    .replaceAll('{{nombre}}', ctx.contactName?.split(' ')[0] ?? '')
    .replaceAll('{{producto}}', ctx.productName ?? 'nuestro producto')
    .trim();
}

/**
 * Genera el texto de un paso de seguimiento. Si el paso trae `aiPrompt`, usa la IA
 * para redactarlo personalizado; si trae `template`, usa la plantilla con variables.
 */
export async function renderStepMessage(opts: {
  template?: string | null;
  aiPrompt?: string | null;
  ctx: RenderContext;
}): Promise<string> {
  if (opts.aiPrompt) {
    const system = `Eres un asesor de ventas cercano y honesto (tuteo, tono latinoamericano).
Escribes un mensaje BREVE de seguimiento (1-3 frases) para reactivar a un cliente.
No presiones ni mientas. Usa solo la informacion dada. Devuelve SOLO el texto del mensaje.`;
    const user = `Cliente: ${opts.ctx.contactName ?? 'desconocido'}
Producto de interes: ${opts.ctx.productName ?? 'no definido'}
Contexto de ventas: ${opts.ctx.salesContext ?? '(sin contexto)'}

Instruccion para este mensaje de seguimiento:
${opts.aiPrompt}`;

    const res = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 300,
      system,
      messages: [{ role: 'user', content: user }],
    });
    return res.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('')
      .trim();
  }

  return renderTemplate(opts.template ?? '', opts.ctx);
}
