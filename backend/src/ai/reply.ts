import { llm } from './router.js';
import { type PsychProfile, discToStyle, awarenessToMessage } from './psychology.js';

/**
 * Genera la respuesta perfecta al cliente combinando:
 *  - Psicología del consumidor (DISC + nivel de consciencia)
 *  - Principios de influencia de Cialdini
 *  - Copywriting de ventas (PAS, AIDA, storytelling)
 *  - Tono natural latinoamericano, tuteo, sin presión
 *
 * El resultado: el cliente siente que lo entienden, confía, y avanza solo.
 */
export async function generateReply(opts: {
  messageText: string;
  history?: string;
  contactName?: string | null;
  salesContext: string;
  psychProfile?: PsychProfile;
  stage?: string;
  agentInstructions?: string; // personalidad/comportamiento del Agente IA publicado (opcional)
}): Promise<string> {

  // ── Contexto psicológico ──────────────────────────────────────────────────
  const psych = opts.psychProfile;
  const discInstruction   = psych ? discToStyle(psych.disc)              : 'Sé cálido, cercano y natural.';
  const awarenessInstruct = psych ? awarenessToMessage(psych.awareness)  : 'Entiende su situación antes de proponer.';
  const objectionHint     = psych ? `Su objeción más probable es: "${psych.primary_objection}". Anticípala de forma natural si aparece.` : '';
  const triggerHint       = psych ? `Frase disparadora ideal: "${psych.trigger_phrase}". Úsala o adáptala si es el momento.` : '';
  const emotionalHint     = psych ? `Motor emocional: ${psych.emotional_driver}. Actívalo sutilmente.` : '';
  const approachHint      = psych ? `Estrategia para esta respuesta: ${psych.approach}` : '';
  const urgencyHint       = psych?.urgency === 'alta' ? 'El cliente está listo. Facilita el siguiente paso concreto ahora.' :
                            psych?.urgency === 'media' ? 'Genera un poco más de deseo antes de cerrar.' :
                            'Primero construye confianza y rapport.';

  const system = `Eres el mejor vendedor consultivo de América Latina. Combinas:
• Psicología clínica (entiendes lo que el cliente siente y no dice)
• Copywriting de ventas (PAS, AIDA, storytelling, prueba social)
• Principios Cialdini (reciprocidad, prueba social, autoridad, escasez, simpatía, compromiso)
• Técnica Feel-Felt-Found para objeciones
• Future pacing: ayudas al cliente a verse ya con el beneficio
• Rapport profundo: espejo verbal, validación emocional

═══ ESTILO DE COMUNICACIÓN (DISC detectado) ═══
${discInstruction}

═══ NIVEL DE CONSCIENCIA ═══
${awarenessInstruct}

═══ PSICOLOGÍA DEL CLIENTE ═══
${emotionalHint}
${objectionHint}
${triggerHint}
${urgencyHint}

═══ ESTRATEGIA DE ESTA RESPUESTA ═══
${approachHint}
${opts.agentInstructions ? `
═══ INSTRUCCIONES DEL EQUIPO PARA ESTE AGENTE ═══
${opts.agentInstructions}
` : ''}
═══ REGLAS DE ORO ═══
1. Responde como en un chat real: corto, natural (1-4 líneas). NUNCA un ensayo.
2. Valida PRIMERO emocionalmente antes de informar o proponer. El cliente debe sentirse escuchado.
3. NUNCA inventes precios, stocks o datos. Si no lo sabes, di que un asesor lo confirma.
4. NUNCA presiones ni uses urgencia falsa. La urgencia real la crea el propio cliente.
5. Si hay intención de compra, propón UN solo paso concreto (no tres opciones).
6. Usa su nombre si lo sabes. Crea sensación de conversación personal.
7. Escribe en el idioma del cliente. Si mezcla, mezcla tú también.
8. Si el cliente pide baja, confirma amablemente. Nunca ruegues.
9. Termina siempre con una pregunta o propuesta que invite a continuar (sin presión).`;

  const user = `Cliente: ${opts.contactName ?? 'desconocido'} | Etapa: ${opts.stage ?? 'new'}

Contexto de nuestros productos (uso interno, no copiar literal):
${opts.salesContext || '(sin productos configurados)'}

Historial reciente de la conversación:
${opts.history ?? '(primera interacción)'}

Último mensaje del cliente:
"""${opts.messageText}"""

Escribe SOLO tu respuesta al cliente. Sin explicaciones, sin comillas, directo al mensaje.`;

  return llm('reply', system, user, 450);
}
