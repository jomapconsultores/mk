import { classifyMessage } from './classify.js';
import { applyClassification, getSalesContext } from '../repo.js';
import { getHistory } from '../orchestrator.js';
import { db } from '../db.js';

/** Recalifica manualmente a un contacto (botón "Recalcular score" del panel). */
export async function rescoreContact(contactId: string): Promise<{ lead_score: number; stage: string }> {
  const { data: contact } = await db
    .from('contacts')
    .select('id, ai_summary')
    .eq('id', contactId)
    .maybeSingle();

  if (!contact) throw new Error('Contacto no encontrado');

  const [{ catalog }, history] = await Promise.all([
    getSalesContext(),
    getHistory(contactId),
  ]);

  const messageText = history
    ? '(sin mensaje nuevo, reevalúa en base al historial de la conversación)'
    : contact.ai_summary || '(sin mensajes ni resumen previo, reevalúa como lead nuevo)';

  const classification = await classifyMessage({ messageText, history, productsCatalog: catalog });
  await applyClassification(contactId, classification);

  return { lead_score: classification.lead_score, stage: classification.stage };
}
