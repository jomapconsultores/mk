'use server';

import { getAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';

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
