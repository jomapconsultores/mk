'use server';

import { getAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

/** Da de baja manualmente a un contacto desde el panel. */
export async function optOut(contactId: string, channel: string) {
  const db = getAdmin();
  await db.rpc('opt_out_contact', {
    p_contact: contactId,
    p_channel: channel,
    p_reason: 'Baja manual desde el panel',
  });
  revalidatePath(`/leads/${contactId}`);
}

/** Activa o desactiva el piloto automático de IA en una conversación. */
export async function toggleAutopilot(conversationId: string, contactId: string, value: boolean) {
  const db = getAdmin();
  await db.from('conversations').update({ ai_autopilot: value }).eq('id', conversationId);
  revalidatePath(`/leads/${contactId}`);
}

/** Avanza/cambia manualmente la etapa del cliente en el embudo ("seguir con el proceso"). */
export async function updateStage(contactId: string, formData: FormData) {
  const db = getAdmin();
  const stage = String(formData.get('stage') ?? '').trim();
  const allowed = ['new', 'engaged', 'qualified', 'negotiating', 'customer', 'lost'];
  if (!allowed.includes(stage)) return;

  await db.from('contacts').update({ stage }).eq('id', contactId);
  await db.from('events').insert({
    contact_id: contactId,
    type: 'stage_changed_manual',
    payload: { stage },
  });
  revalidatePath(`/leads/${contactId}`);
}

/** Elimina el cliente y todo su historial ("borrar el trabajo inconcluso"). */
export async function deleteContact(contactId: string) {
  const db = getAdmin();
  // Las tablas relacionadas (mensajes, conversaciones, etc.) se borran en cascada.
  await db.from('contacts').delete().eq('id', contactId);
  revalidatePath('/leads');
  redirect('/leads');
}
