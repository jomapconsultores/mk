'use server';

import { getAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';

const ALLOWED_STAGES = ['new', 'engaged', 'qualified', 'negotiating', 'customer', 'lost'];

/** Cambia la etapa de un contacto al soltarlo en otra columna del Kanban. */
export async function moveContactStage(contactId: string, newStage: string) {
  if (!ALLOWED_STAGES.includes(newStage)) return;
  const db = getAdmin();

  await db.from('contacts').update({ stage: newStage }).eq('id', contactId);
  await db.from('events').insert({
    contact_id: contactId,
    type: 'stage_changed_manual',
    payload: { stage: newStage, source: 'kanban' },
  });

  revalidatePath('/ventas');
  revalidatePath(`/leads/${contactId}`);
}
