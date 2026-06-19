import { getAdmin } from '@/lib/supabase-admin';
import { STAGE_LABELS, STAGE_COLORS, INTEREST_LABELS, fmtDate } from '@/lib/format';
import { optOut } from './actions';

export const dynamic = 'force-dynamic';

const SENDER_LABEL: Record<string, string> = {
  ai: '🤖 IA', human: '🧑 Asesor', sequence: '🔁 Seguimiento', system: '⚙️ Sistema',
};

export default async function LeadDetail({ params }: { params: { id: string } }) {
  const db = getAdmin();

  const { data: c } = await db
    .from('contacts')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!c) return <p className="empty">Cliente no encontrado.</p>;

  const { data: messages } = await db
    .from('messages')
    .select('id, direction, body, sender_type, ai_intent, created_at')
    .eq('contact_id', params.id)
    .order('created_at', { ascending: true })
    .limit(200);

  const { data: events } = await db
    .from('events')
    .select('type, created_at')
    .eq('contact_id', params.id)
    .order('created_at', { ascending: false })
    .limit(8);

  const name = c.display_name || c.full_name || c.phone || 'Sin nombre';

  return (
    <>
      <p style={{ marginBottom: 12 }}><a href="/leads">← Volver a clientes</a></p>
      <h2>{name}</h2>
      <p className="subtitle">
        <span className="badge" style={{ background: STAGE_COLORS[c.stage] }}>{STAGE_LABELS[c.stage] ?? c.stage}</span>
        {'  '}Interés: {c.interest_level ? INTEREST_LABELS[c.interest_level] : '—'} · Score: {c.lead_score}
        {c.marketing_opted_out && <span style={{ color: '#ef4444', marginLeft: 10 }}>● dado de baja</span>}
      </p>

      <div className="row2">
        <div className="section">
          <h3>Datos</h3>
          <p style={{ lineHeight: 1.9 }}>
            <strong>Teléfono:</strong> {c.phone || '—'}<br />
            <strong>Email:</strong> {c.email || '—'}<br />
            <strong>Canal de origen:</strong> {c.source_channel || '—'}<br />
            <strong>Creado:</strong> {fmtDate(c.created_at)}<br />
            <strong>Último mensaje recibido:</strong> {fmtDate(c.last_inbound_at)}
          </p>
          {c.ai_summary && (
            <p style={{ marginTop: 12, color: 'var(--muted)' }}>
              <strong style={{ color: 'var(--text)' }}>Resumen IA:</strong> {c.ai_summary}
            </p>
          )}
          {!c.marketing_opted_out && (
            <form action={optOut.bind(null, c.id, c.source_channel || 'whatsapp')} style={{ marginTop: 16 }}>
              <button className="danger" type="submit">Dar de baja</button>
            </form>
          )}
        </div>

        <div className="section">
          <h3>Actividad reciente</h3>
          {(events ?? []).length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Sin actividad registrada.</p>
          ) : (
            <ul style={{ listStyle: 'none', lineHeight: 2 }}>
              {(events ?? []).map((e, i) => (
                <li key={i}>· <strong>{e.type}</strong> <span style={{ color: 'var(--muted)' }}>{fmtDate(e.created_at)}</span></li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="section">
        <h3>Conversación</h3>
        {(messages ?? []).length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>Aún no hay mensajes con este cliente.</p>
        ) : (
          <div>
            {(messages ?? []).map((m) => (
              <div key={m.id} className={`msg ${m.direction}`}>
                {m.body}
                <div className="meta">
                  {m.direction === 'inbound' ? '⬅️ Cliente' : SENDER_LABEL[m.sender_type ?? ''] ?? 'Saliente'}
                  {m.ai_intent ? ` · ${m.ai_intent}` : ''} · {fmtDate(m.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
