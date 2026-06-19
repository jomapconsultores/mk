import { getAdmin } from '@/lib/supabase-admin';
import { STAGE_LABELS, STAGE_COLORS, INTEREST_LABELS, fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: { stage?: string };
}) {
  const db = getAdmin();
  let q = db
    .from('contacts')
    .select('id, display_name, full_name, phone, stage, interest_level, lead_score, source_channel, last_inbound_at, marketing_opted_out')
    .order('lead_score', { ascending: false })
    .limit(200);

  if (searchParams.stage) q = q.eq('stage', searchParams.stage);

  const { data: contacts } = await q;

  return (
    <>
      <h2>Clientes</h2>
      <p className="subtitle">Ordenados por probabilidad de compra (score). Haz clic para ver la conversación.</p>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a href="/leads" className="badge" style={{ background: '#475569' }}>Todos</a>
        {Object.entries(STAGE_LABELS).map(([k, label]) => (
          <a key={k} href={`/leads?stage=${k}`} className="badge" style={{ background: STAGE_COLORS[k] }}>{label}</a>
        ))}
      </div>

      <table>
        <thead>
          <tr><th>Cliente</th><th>Etapa</th><th>Interés</th><th>Score</th><th>Canal</th><th>Último mensaje</th></tr>
        </thead>
        <tbody>
          {(contacts ?? []).map((c) => (
            <tr key={c.id}>
              <td>
                <a href={`/leads/${c.id}`}>{c.display_name || c.full_name || c.phone || 'Sin nombre'}</a>
                {c.marketing_opted_out && <span style={{ color: '#ef4444', marginLeft: 8, fontSize: 11 }}>● baja</span>}
              </td>
              <td><span className="badge" style={{ background: STAGE_COLORS[c.stage] }}>{STAGE_LABELS[c.stage] ?? c.stage}</span></td>
              <td>{c.interest_level ? INTEREST_LABELS[c.interest_level] : '—'}</td>
              <td>
                <span className="score-bar"><span style={{ width: `${c.lead_score}%` }} /></span> {c.lead_score}
              </td>
              <td>{c.source_channel ?? '—'}</td>
              <td>{fmtDate(c.last_inbound_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {(!contacts || contacts.length === 0) && <p className="empty">No hay clientes en esta vista todavía.</p>}
    </>
  );
}
