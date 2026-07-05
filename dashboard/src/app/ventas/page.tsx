import { getAdmin } from '@/lib/supabase-admin';
import { STAGE_ORDER } from '@/lib/format';
import KanbanBoard, { type KanbanContact } from './KanbanBoard';

export const dynamic = 'force-dynamic';

export default async function VentasPage() {
  const db = getAdmin();
  const { data } = await db
    .from('contacts')
    .select('id, display_name, full_name, phone, stage, lead_score, interest_level, source_channel, last_inbound_at')
    .order('lead_score', { ascending: false })
    .limit(500);

  const contacts = (data ?? []) as KanbanContact[];
  const contactsByStage: Record<string, KanbanContact[]> = {};
  for (const stage of STAGE_ORDER) contactsByStage[stage] = [];
  for (const c of contacts) {
    if (!contactsByStage[c.stage]) contactsByStage[c.stage] = [];
    contactsByStage[c.stage].push(c);
  }

  return (
    <>
      <h2>Pipeline de ventas</h2>
      <p className="subtitle">Arrastra las tarjetas entre columnas para actualizar la etapa de cada cliente.</p>
      <KanbanBoard contactsByStage={contactsByStage} />
    </>
  );
}
