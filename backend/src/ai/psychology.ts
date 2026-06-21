import { llm } from './router.js';

/**
 * Perfil psicológico de un contacto.
 * Alimenta al agente de respuesta para personalizar el tono, los argumentos y el timing.
 */
export interface PsychProfile {
  disc: 'D' | 'I' | 'S' | 'C';           // estilo de comunicación predominante
  awareness: 1 | 2 | 3 | 4 | 5;          // nivel de consciencia del problema/solución
  emotional_driver: string;               // motor emocional principal
  primary_objection: string;              // objeción más probable
  tone_preferred: 'formal' | 'casual' | 'tecnico' | 'emocional';
  urgency: 'alta' | 'media' | 'baja';
  trigger_phrase: string;                 // frase que lo movería a actuar ahora
  approach: string;                       // qué estrategia usar en la próxima respuesta
}

/**
 * Analiza el perfil psicológico de un contacto a partir de sus mensajes.
 *
 * Modelos usados:
 *  DISC  — estilo de comportamiento (Dominante / Influyente / Estable / Concienzudo)
 *  Schwartz (5 niveles de consciencia) — qué tan listo está para comprar
 *  Cialdini — qué palanca de influencia aplica mejor
 *  PAS / AIDA — qué fase del embudo activo ejecutar
 */
export async function analyzePsychology(opts: {
  messages: string;          // historial de mensajes del contacto (texto plano)
  contactName?: string | null;
  stage?: string;            // etapa CRM actual
  interest_level?: string;
  lead_score?: number;
  productContext?: string;
}): Promise<PsychProfile> {
  const system = `Eres un experto en psicología del consumidor, ventas consultivas y análisis de comportamiento.
Analiza los mensajes de un cliente y devuelve SOLO un JSON válido con estas claves exactas:

disc: una letra "D" (Dominante: directo, orientado a resultados, impaciente),
      "I" (Influyente: social, entusiasta, le importa cómo lo ven los demás),
      "S" (Estable: tranquilo, leal, evita riesgos, necesita seguridad),
      "C" (Concienzudo: analítico, preciso, necesita datos y garantías)

awareness: número 1-5 según Eugene Schwartz:
  1 = Inconsciente (no sabe que tiene un problema)
  2 = Consciente del problema (sabe que tiene un dolor pero no busca solución)
  3 = Consciente de la solución (sabe que existen soluciones pero no conoce la nuestra)
  4 = Consciente del producto (nos conoce pero duda en comprar)
  5 = Listo para comprar (solo necesita el empujón final)

emotional_driver: su motor emocional principal en una frase corta.
  Opciones: "miedo a perder dinero", "deseo de estatus", "necesidad de seguridad",
  "quiere ahorrar tiempo", "busca aprobación social", "orgullo de dueño",
  "miedo a quedarse atrás", "quiere sentirse inteligente al comprar"

primary_objection: su objeción más probable. Opciones:
  "el precio es alto", "no confía todavía", "no tiene tiempo de decidir",
  "no ve la necesidad urgente", "prefiere comparar primero", "necesita consultarlo",
  "no entiende bien el producto"

tone_preferred: "formal", "casual", "tecnico" o "emocional"

urgency: "alta", "media" o "baja"

trigger_phrase: la frase exacta (1 oración) que más probabilidad tiene de moverlo a actuar
  AHORA. Debe ser específica a su situación, no genérica.

approach: en 1-2 oraciones, exactamente qué estrategia usar en la próxima respuesta:
  qué principio de influencia aplicar (Cialdini), qué emoción activar, qué objeción anticipar.

Sin texto fuera del JSON.`;

  const user = `Datos del cliente:
- Nombre: ${opts.contactName ?? 'desconocido'}
- Etapa CRM: ${opts.stage ?? 'new'}
- Nivel de interés: ${opts.interest_level ?? 'low'}
- Score: ${opts.lead_score ?? 0}/100
- Productos en contexto: ${opts.productContext ?? 'no especificado'}

Historial de mensajes del cliente:
---
${opts.messages || '(sin mensajes previos)'}
---`;

  try {
    const text = await llm('classify', system, user, 700);
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    return JSON.parse(json) as PsychProfile;
  } catch {
    // Perfil neutro de fallback — funciona bien para leads nuevos sin historial
    return {
      disc: 'S',
      awareness: 2,
      emotional_driver: 'quiere sentirse seguro con su decisión',
      primary_objection: 'no ve la necesidad urgente',
      tone_preferred: 'casual',
      urgency: 'baja',
      trigger_phrase: '¿Qué sería lo más útil para ti en este momento?',
      approach: 'Construir confianza primero. Hacer una pregunta abierta para entender su situación real.',
    };
  }
}

/**
 * Traduce el perfil DISC a instrucciones concretas de tono y argumentación.
 */
export function discToStyle(disc: PsychProfile['disc']): string {
  const styles = {
    D: 'Sé directo, ve al grano, habla de resultados y ROI. No des rodeos. Usa frases cortas y contundentes. Énfasis en: rapidez, control, logros concretos.',
    I: 'Sé entusiasta y social. Habla de cómo lo harán quedar bien. Usa historias y ejemplos de otros que lo lograron. Énfasis en: imagen, reconocimiento, ser parte de algo especial.',
    S: 'Sé paciente, cálido y sin presión. Dale tiempo. Habla de seguridad, garantías y soporte. Énfasis en: tranquilidad, confianza, que no corre riesgos.',
    C: 'Sé preciso y detallado. Dile hechos, datos y especificaciones. Responde sus dudas con evidencia. Énfasis en: calidad, garantías, comparativas, lógica.',
  };
  return styles[disc];
}

/**
 * Traduce el nivel de consciencia a qué mensaje dar.
 */
export function awarenessToMessage(level: PsychProfile['awareness']): string {
  const messages = {
    1: 'Primero despierta el problema con una pregunta o dato sorprendente. No menciones tu producto todavía.',
    2: 'Muestra que entiendes su dolor. Agita el problema (¿qué pasa si no lo resuelves?). Luego insinúa que hay solución.',
    3: 'Diferencia tu solución de las demás. Muestra por qué la tuya es la mejor opción para su caso específico.',
    4: 'Elimina sus dudas y objeciones. Usa prueba social, garantías y un llamado a la acción claro.',
    5: 'Cierra. Ofrece una razón para actuar HOY (no mañana). Puede ser una oferta, un cupo limitado, o simplemente facilitar el siguiente paso.',
  };
  return messages[level];
}
