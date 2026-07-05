import { llm } from '../ai/router.js';
import { db } from '../db.js';

export interface ProspectQualification {
  fit_score: number;
  industry: string;
  main_pain: string;
  outreach_angle: string;
  recommended_product_id: string | null;
  ai_profile_summary: string;
  // Perfil psicológico para personalizar el outreach
  disc_estimate: 'D' | 'I' | 'S' | 'C';
  awareness_level: 1 | 2 | 3 | 4 | 5;
  emotional_hook: string;
  best_channel: 'email' | 'whatsapp' | 'instagram';
  icebreaker: string;   // primera frase perfecta para romper el hielo
}

/**
 * Califica y perfila psicológicamente un prospecto.
 *
 * Determina:
 *  - Qué tan buen fit es (0-100)
 *  - Qué le duele y cómo acercarnos
 *  - Su perfil de comportamiento (DISC)
 *  - Su nivel de consciencia del problema
 *  - El mejor canal y la mejor primera frase
 */
export interface ActiveProduct {
  id: string;
  name: string;
  description?: string | null;
  sales_brief?: string | null;
}

/** Trae la lista de productos activos. Pensado para llamarse una sola vez por lote de calificación. */
export async function fetchActiveProducts(): Promise<ActiveProduct[]> {
  const { data: products } = await db
    .from('products')
    .select('id, name, description, sales_brief')
    .eq('is_active', true);
  return products ?? [];
}

export async function qualifyProspect(
  prospect: {
    full_name?: string | null;
    company?: string | null;
    industry?: string | null;
    location?: string | null;
    website?: string | null;
    raw_data?: Record<string, unknown>;
  },
  products?: ActiveProduct[],
): Promise<ProspectQualification> {
  const activeProducts = products ?? (await fetchActiveProducts());

  const productList = activeProducts
    .map((p) => `- ID:${p.id} | ${p.name}: ${(p.description ?? '') + ' ' + (p.sales_brief ?? '')}`.trim())
    .join('\n');

  const system = `Eres un experto en ventas B2B/B2C, marketing digital y psicología del consumidor.
Analiza este prospecto con profundidad y devuelve SOLO un JSON válido con estas claves:

fit_score: entero 0-100. Qué tan probable es que necesite y compre nuestros productos.
  100 = encaje perfecto y urgente. 0 = no es cliente potencial.

industry: industria o sector real del negocio/persona.

main_pain: el problema más probable que tiene este prospecto en su día a día,
  relacionado con lo que vendemos. Sé específico, no genérico.
  Malo: "necesita mejorar su negocio"
  Bueno: "pierde clientes porque no hace seguimiento automatizado"

outreach_angle: en 1 frase, la forma más natural de acercarnos SIN vender nada todavía.
  Debe ser algo que genuinamente le ayude o interese.

recommended_product_id: ID exacto del producto más adecuado (de la lista), o null.

ai_profile_summary: resumen breve del prospecto en 1-2 frases, como lo diría un vendedor experto
  que ya lo investigó.

disc_estimate: letra "D", "I", "S" o "C" basado en el tipo de negocio y sector.
  D = ejecutivos, dueños de empresas grandes, sectores competitivos
  I = creativos, servicios al cliente, entretenimiento, redes sociales
  S = sectores estables (educación, salud, gobierno, familia)
  C = contabilidad, ingeniería, tecnología, sectores regulados

awareness_level: número 1-5.
  1 = no sabe que tiene el problema
  2 = sabe que tiene el problema pero no busca solución
  3 = busca soluciones pero no nos conoce
  4 = nos conoce pero no ha comprado
  5 = listo para comprar

emotional_hook: la emoción principal que lo mueve a comprar (1 frase).
  Ejemplos: "miedo a perder clientes", "deseo de tener más tiempo libre",
  "orgullo de tener el negocio más moderno del sector", "seguridad de no depender de una sola persona"

best_channel: "email", "whatsapp" o "instagram" según su perfil y sector.

icebreaker: la primera frase EXACTA (máx 15 palabras) con la que romperías el hielo con este prospecto.
  Debe ser específica a SU situación, no genérica. Que piense "¿cómo sabe esto de mí?"

Sin texto fuera del JSON.`;

  const user = `Nuestros productos:
${productList || '(sin productos registrados)'}

Prospecto a analizar:
- Nombre: ${prospect.full_name ?? 'desconocido'}
- Empresa: ${prospect.company ?? 'desconocida'}
- Industria: ${prospect.industry ?? 'no especificada'}
- Ubicación: ${prospect.location ?? 'no especificada'}
- Sitio web: ${prospect.website ?? 'no disponible'}
- Datos adicionales: ${JSON.stringify(prospect.raw_data ?? {})}`;

  try {
    const text = await llm('classify', system, user, 800);
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const parsed = JSON.parse(json) as ProspectQualification;
    parsed.fit_score = Math.max(0, Math.min(100, Math.round(parsed.fit_score ?? 0)));
    return parsed;
  } catch (err) {
    console.error('[qualifier] fallo en calificación:', err);
    return {
      fit_score: 30,
      industry: prospect.industry ?? 'desconocida',
      main_pain: 'por determinar con más información',
      outreach_angle: 'compartir un insight valioso para su sector',
      recommended_product_id: null,
      ai_profile_summary: `${prospect.full_name ?? 'Prospecto'} de ${prospect.company ?? 'empresa desconocida'}. Requiere más datos para perfilar.`,
      disc_estimate: 'S',
      awareness_level: 2,
      emotional_hook: 'quiere sentirse seguro con sus decisiones',
      best_channel: 'email',
      icebreaker: '¿Qué es lo que más tiempo te está quitando en tu negocio ahora mismo?',
    };
  }
}
