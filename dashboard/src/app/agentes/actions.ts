'use server';

import { getAdmin } from '@/lib/supabase-admin';
import { requireAccess } from '@/lib/access';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

// Debe coincidir EXACTAMENTE con ESCALATE_MARKER en backend/src/ai/agents.ts
// (mismo patrón de duplicación intencional que AGENT_CAPABILITIES, ver
// dashboard/src/lib/agent-capabilities.ts). orchestrator.ts busca este texto
// literal en la respuesta del modelo para decidir si marca needs_human=true.
const ESCALATE_PREFIX =
  'Si detectas frustración fuerte o el cliente pide explícitamente hablar con una persona, ' +
  'responde EXACTAMENTE con el texto "[[ESCALATE_HUMANO]]" y nada más, sin agregar nada antes ni después.\n\n';

/**
 * Antepone la instrucción del marcador de escalado cuando la capacidad está
 * marcada. Se hace acá (al guardar), no en el textarea del usuario, para que
 * nadie tenga que escribir el marcador a mano ni pueda desalinearlo.
 */
function buildInstructions(raw: string, capabilities: string[]): string {
  const clean = raw.trim();
  return capabilities.includes('escalate_on_frustration') ? ESCALATE_PREFIX + clean : clean;
}

/** Crea un agente en borrador (paso 1 del wizard: solo el nombre) y va al paso 2. */
export async function createAgentDraft(formData: FormData) {
  await requireAccess('agentes.gestion');
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;

  const db = getAdmin();
  const { data, error } = await db.from('ai_agents').insert({ name }).select('id').single();
  if (error || !data) return; // ej. nombre duplicado (ux_ai_agents_name) — TODO: mostrar el error en la UI
  revalidatePath('/agentes');
  redirect(`/agentes/${data.id}?step=2`);
}

/** Guarda nombre + instrucciones + capacidades del agente (pasos 1-3), sin publicar. */
export async function updateAgentDraft(id: string, formData: FormData) {
  await requireAccess('agentes.gestion');
  const db = getAdmin();

  const name = String(formData.get('name') ?? '').trim();
  const rawInstructions = String(formData.get('instructions') ?? '');
  const capabilities = formData.getAll('capabilities').map(String);

  const update: Record<string, unknown> = {
    instructions: buildInstructions(rawInstructions, capabilities),
    capabilities,
  };
  if (name) update.name = name;

  await db.from('ai_agents').update(update).eq('id', id);
  revalidatePath(`/agentes/${id}`);
  revalidatePath('/agentes');
}

/** Publica este agente: despublica el anterior de forma atómica (función SQL, sin ventana de carrera). */
export async function publishAgent(id: string) {
  await requireAccess('agentes.gestion');
  const db = getAdmin();
  await db.rpc('publish_ai_agent', { p_id: id });
  revalidatePath('/agentes');
  revalidatePath(`/agentes/${id}`);
}

/** Retira este agente de producción (vuelve a borrador) sin borrarlo. */
export async function unpublishAgent(id: string) {
  await requireAccess('agentes.gestion');
  const db = getAdmin();
  await db.from('ai_agents').update({ status: 'draft', published_at: null }).eq('id', id);
  revalidatePath('/agentes');
  revalidatePath(`/agentes/${id}`);
}

/** Elimina un agente en borrador. El publicado no se puede borrar sin despublicarlo antes. */
export async function deleteAgent(id: string) {
  await requireAccess('agentes.gestion');
  const db = getAdmin();
  await db.from('ai_agents').delete().eq('id', id).neq('status', 'published');
  revalidatePath('/agentes');
  redirect('/agentes');
}
