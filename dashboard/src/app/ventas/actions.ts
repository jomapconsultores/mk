'use server';

import { getAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';

const ALLOWED_STAGES = ['new', 'engaged', 'qualified', 'negotiating', 'customer', 'lost'];

/** Cambia la etapa de un contacto al soltarlo en otra columna del Kanban. */
export async function moveContactStage(
  contactId: string,
  newStage: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!ALLOWED_STAGES.includes(newStage)) return { ok: false, error: 'Etapa inválida' };
  const db = getAdmin();

  const { error } = await db.from('contacts').update({ stage: newStage }).eq('id', contactId);
  if (error) return { ok: false, error: error.message };

  await db.from('events').insert({
    contact_id: contactId,
    type: 'stage_changed_manual',
    payload: { stage: newStage, source: 'kanban' },
  });

  revalidatePath('/ventas');
  revalidatePath(`/leads/${contactId}`);
  return { ok: true };
}
