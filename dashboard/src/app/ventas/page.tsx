import { getAdmin } from '@/lib/supabase-admin';
import { STAGE_LABELS, STAGE_COLORS, STAGE_ORDER, fmtDate } from '@/lib/format';
import KanbanBoard, { type KanbanContact } from './KanbanBoard';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL ?? '';

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

  const priority = contacts
    .filter((c) => c.stage !== 'customer' && c.stage !== 'lost')
    .slice(0, 10);

  return (
    <>
      <h2>Pipeline de ventas</h2>
      <p className="subtitle">Arrastra las tarjetas entre columnas para actualizar la etapa de cada cliente.</p>

      <div className="section">
        <h3>Prioridad IA</h3>
        {priority.length === 0 ? (
          <p className="empty">No hay clientes activos todavía.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Cliente</th><th>Etapa</th><th>Score</th><th>Canal</th><th>Último mensaje</th></tr>
            </thead>
            <tbody>
              {priority.map((c) => (
                <tr key={c.id}>
                  <td><a href={`/leads/${c.id}`}>{c.display_name || c.full_name || c.phone || 'Sin nombre'}</a></td>
                  <td><span className="badge" style={{ background: STAGE_COLORS[c.stage] }}>{STAGE_LABELS[c.stage] ?? c.stage}</span></td>
                  <td>
                    <span className="score-bar"><span style={{ width: `${c.lead_score ?? 0}%` }} /></span> {c.lead_score ?? 0}
                  </td>
                  <td>{c.source_channel ?? '—'}</td>
                  <td>{fmtDate(c.last_inbound_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <KanbanBoard contactsByStage={contactsByStage} backendUrl={BACKEND_URL} />
    </>
  );
}
