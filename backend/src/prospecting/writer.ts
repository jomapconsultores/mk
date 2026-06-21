import { llm } from '../ai/router.js';

type MessageIntent = 'value_first' | 'followup_question' | 'social_proof' | 'breakup';

/**
 * Genera mensajes de outreach que se sienten 100% humanos y naturales.
 *
 * Cada paso usa una técnica psicológica distinta:
 *  1. value_first     → Reciprocidad (Cialdini #1): dar primero crea obligación de devolver
 *  2. followup        → Curiosidad + dolor: la mente no puede ignorar una pregunta sin responder
 *  3. social_proof    → Prueba social (Cialdini #3) + transformación: "alguien como tú lo logró"
 *  4. breakup         → Reactancia psicológica: cuando retiras la oferta, el deseo sube
 */
export async function writeOutreachMessage(opts: {
  channel: string;
  intent: MessageIntent;
  aiPrompt: string;
  prospect: {
    full_name?: string | null;
    company?: string | null;
    industry?: string | null;
    location?: string | null;
    main_pain?: string | null;
    outreach_angle?: string | null;
  };
  productContext?: string;
  psychContext?: {
    disc?: string | null;
    awareness?: number | null;
    emotional_hook?: string | null;
  };
}): Promise<{ subject?: string; body: string }> {

  // ── Formato según canal ──────────────────────────────────────────────────
  const channelFormat: Record<string, string> = {
    email:
      'EMAIL: Primera línea = asunto atractivo (sin escribir "Asunto:"). Línea en blanco. Luego cuerpo (máx 90 palabras). Firma breve al final. El asunto debe generar curiosidad o tocar un dolor específico, no ser genérico.',
    whatsapp:
      'WHATSAPP: Máximo 3 líneas. Sin saludos formales. Directo, conversacional, como si lo conociera de antes. Sin bullet points. Sin emojis exagerados (máx 1 si encaja muy bien).',
    instagram:
      'INSTAGRAM DM: Máximo 2 líneas. Muy breve. Empático. Que parezca un mensaje de alguien que genuinamente se interesó en su perfil.',
  };

  // ── Técnica psicológica por intención ───────────────────────────────────
  const psychTechnique: Record<MessageIntent, string> = {
    value_first: `
TÉCNICA: RECIPROCIDAD (Cialdini) + CURIOSIDAD GAP
• Da un insight, dato o consejo específico y valioso ANTES de pedir nada.
• No menciones tu empresa ni tus productos todavía. Solo dale valor.
• Crea una "brecha de curiosidad": termina con una pregunta que abra una conversación genuina.
• El mensaje debe sonar como de alguien que investigó y encontró algo útil para ellos, no como spam.
• Anti-patrones a EVITAR: "¿podría ayudarte?", "¿tienes 5 minutos?", "somos la empresa líder en..."`,

    followup_question: `
TÉCNICA: AGITACIÓN DEL DOLOR + COMPROMISO COGNITIVO
• Reconoce brevemente que quizás no era el momento (muestra que entiendes su realidad).
• Haz UNA sola pregunta muy específica sobre un problema que probablemente tiene en su industria.
• La pregunta debe hacer que el prospecto piense "¿cómo sabe esto?". Debe doler un poco.
• No menciones soluciones. Solo la pregunta. La mente que responde una pregunta ya está comprometida.
• Máximo 2 líneas. Nada más.`,

    social_proof: `
TÉCNICA: PRUEBA SOCIAL + TRANSFORMACIÓN (Before/After/Bridge)
• Menciona brevemente una situación que ANTES tenía un cliente similar a este prospecto.
• Describe el cambio (DESPUÉS) de forma concreta y deseable. Sin inventar números exactos.
• Usa frases como "Alguien en tu mismo sector..." o "Un negocio similar al tuyo logró..."
• Invita a una conversación corta para ver si aplica a su caso.
• Que suene como una historia real, no como un anuncio.`,

    breakup: `
TÉCNICA: REACTANCIA PSICOLÓGICA (cuando retiras algo, el deseo sube)
• Mensaje de cierre cálido y genuino. SIN presión, SIN ultimátum falso.
• Deja claro que respetas su decisión y que no volverás a escribir.
• Incluye una última línea que deje la puerta abierta de forma elegante.
• El objetivo: que si en el futuro tiene el problema, piense en ti primero.
• Hazlo sonar como alguien maduro que entiende que no todos son clientes.`,
  };

  // ── Contexto psicológico del prospecto ──────────────────────────────────
  const p = opts.psychContext;
  const discNote = p?.disc
    ? { D: 'Prospecto DISC-D: directo, orientado a resultados. Ve al grano y habla de impacto concreto.',
        I: 'Prospecto DISC-I: social, le importa su imagen. Usa entusiasmo y referencia a pares exitosos.',
        S: 'Prospecto DISC-S: estable, evita riesgos. Sé cálido, sin presión, transmite seguridad.',
        C: 'Prospecto DISC-C: analítico, necesita datos. Sé preciso, específico, basa todo en evidencia.',
      }[p.disc] ?? ''
    : '';
  const awarenessNote = p?.awareness
    ? [`Nivel de consciencia ${p.awareness}/5: `,
        p.awareness <= 2 ? 'NO sabe que tiene el problema. Despiértalo con un dato o pregunta sorprendente.' :
        p.awareness === 3 ? 'Sabe que existe solución pero no nos conoce. Diferénciate.' :
        p.awareness >= 4 ? 'Ya nos conoce o busca activamente. Elimina dudas y facilita el sí.' : ''
      ].join('')
    : '';
  const emotionNote = p?.emotional_hook ? `Motor emocional: ${p.emotional_hook}. Actívalo sutilmente.` : '';

  const system = `Eres un experto mundial en ventas consultivas, psicología del consumidor y redacción persuasiva.
Tu especialidad: escribir mensajes de primer contacto que se sientan 100% humanos, relevantes y naturales,
nunca como spam o como un vendedor desesperado.

Principios que guían tu escritura:
• Un mensaje que ayuda convierte mejor que uno que vende.
• La especificidad genera confianza. Lo genérico genera desconfianza.
• Cada mensaje habla directamente AL prospecto, no sobre nosotros.
• Las personas compran por razones emocionales y justifican con lógica.
• El respeto genera más ventas que la insistencia.

${channelFormat[opts.channel] ?? channelFormat.email}

${psychTechnique[opts.intent]}

═══ PERFIL PSICOLÓGICO DEL PROSPECTO ═══
${discNote}
${awarenessNote}
${emotionNote}`.trim();

  const user = `Datos del prospecto:
- Nombre: ${opts.prospect.full_name ?? 'desconocido'}
- Empresa/Negocio: ${opts.prospect.company ?? 'sin nombre'}
- Industria/Sector: ${opts.prospect.industry ?? 'no especificada'}
- Ubicación: ${opts.prospect.location ?? 'no especificada'}
- Dolor principal detectado: ${opts.prospect.main_pain ?? 'no determinado'}
- Ángulo de entrada ideal: ${opts.prospect.outreach_angle ?? 'valor y empatía'}

Referencia interna de producto (NO mencionar directamente todavía):
${opts.productContext ?? '(sin producto asignado)'}

Instrucción adicional del paso de campaña:
${opts.aiPrompt}

Escribe SOLO el mensaje final. Sin explicaciones ni etiquetas.`;

  const raw = await llm('reply', system, user, 350);

  // Para email: separar asunto del cuerpo
  if (opts.channel === 'email') {
    const lines = raw.split('\n').filter((l) => l.trim());
    if (lines.length >= 2) {
      const subject = lines[0].replace(/^(asunto|subject)\s*:\s*/i, '').trim();
      const body = lines.slice(1).join('\n').trim();
      return { subject, body };
    }
  }

  return { body: raw.trim() };
}
