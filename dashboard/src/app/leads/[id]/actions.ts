'use server';

import { getAdmin } from '@/lib/supabase-admin';
import { requireAccess } from '@/lib/access';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

/** Da de baja manualmente a un contacto desde el panel. */
export async function optOut(contactId: string, channel: string) {
  await requireAccess('ventas.clientes');
  const db = getAdmin();
  await db.rpc('opt_out_contact', {
    p_contact: contactId,
    p_channel: channel,
    p_reason: 'Baja manual desde el panel',
  });
  revalidatePath(`/leads/${contactId}`);
}

/**
 * Envía una respuesta manual del asesor al cliente, vía el backend (que es
 * quien tiene las credenciales del canal y guarda el mensaje en `messages`).
 *
 * Llama server-side con el secreto interno: nunca pasa por el navegador. Antes
 * el vendedor tenía que responder por fuera, en WhatsApp Web, y esa respuesta
 * no quedaba en el sistema.
 */
export async function sendManualReply(contactId: string, formData: FormData) {
  await requireAccess('ventas.clientes');
  const body = String(formData.get('body') ?? '').trim();
  const channel = String(formData.get('channel') ?? 'whatsapp');
  if (!body) return;

  const backendUrl = process.env.BACKEND_URL ?? '';
  const secret = process.env.INTERNAL_API_SECRET ?? '';
  if (!backendUrl || !secret) {
    console.error('[sendManualReply] falta BACKEND_URL o INTERNAL_API_SECRET en el dashboard');
    return;
  }

  try {
    const res = await fetch(`${backendUrl}/messages/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-secret': secret },
      body: JSON.stringify({ contact_id: contactId, body, channel }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[sendManualReply] el backend rechazó el envío:', res.status, detail.slice(0, 300));
    }
  } catch (err) {
    console.error('[sendManualReply] no se pudo contactar al backend:', err);
  }

  revalidatePath(`/leads/${contactId}`);
}

/** Activa o desactiva el piloto automático de IA en una conversación. */
export async function toggleAutopilot(conversationId: string, contactId: string, value: boolean) {
  await requireAccess('ventas.clientes');
  const db = getAdmin();
  await db.from('conversations').update({ ai_autopilot: value }).eq('id', conversationId);
  revalidatePath(`/leads/${contactId}`);
}

/**
 * Marca como atendida la petición de hablar con una persona. Es la única vía
 * que apaga `needs_human`: el backend solo lo enciende (orchestrator.ts), así
 * que sin esto la bandera se quedaba encendida para siempre.
 */
export async function clearNeedsHuman(contactId: string) {
  await requireAccess('ventas.clientes');
  const db = getAdmin();
  await db.from('contacts').update({ needs_human: false }).eq('id', contactId);
  await db.from('events').insert({
    contact_id: contactId,
    type: 'needs_human_cleared',
    payload: {},
  });
  revalidatePath(`/leads/${contactId}`);
  revalidatePath('/leads');
}

/** Avanza/cambia manualmente la etapa del cliente en el embudo ("seguir con el proceso"). */
export async function updateStage(contactId: string, formData: FormData) {
  await requireAccess('ventas.clientes');
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
  await requireAccess('ventas.clientes');
  const db = getAdmin();
  // Las tablas relacionadas (mensajes, conversaciones, etc.) se borran en cascada.
  await db.from('contacts').delete().eq('id', contactId);
  revalidatePath('/leads');
  redirect('/leads');
}
