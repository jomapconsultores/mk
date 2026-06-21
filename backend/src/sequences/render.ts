import { llm } from '../ai/router.js';

export interface RenderContext {
  contactName?: string | null;
  productName?: string | null;
  salesContext?: string;
}

export function renderTemplate(template: string, ctx: RenderContext): string {
  return template
    .replaceAll('{{nombre}}', ctx.contactName?.split(' ')[0] ?? '')
    .replaceAll('{{producto}}', ctx.productName ?? 'nuestro producto')
    .trim();
}

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

    return llm('sequence', system, user, 300);
  }

  return renderTemplate(opts.template ?? '', opts.ctx);
}
