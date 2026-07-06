import { getAdmin } from '@/lib/supabase-admin';
import { STAGE_LABELS, STAGE_COLORS, INTEREST_LABELS, STAGE_ORDER, fmtDate } from '@/lib/format';
import { optOut, updateStage, deleteContact } from './actions';
import { requireAccess } from '@/lib/access';
import RescoreButton from '../../ventas/RescoreButton';
import CallButton from '../../ventas/CallButton';

export const dynamic = 'force-dynamic';

// Proxy autenticado (server-side) hacia el backend real — ver
// src/app/api/backend/[...path]/route.ts. RescoreButton/CallButton llaman
// desde el navegador a esta ruta local, nunca al backend real directo
// (/leads/rescore y /calls/initiate ahora requieren el secreto interno).
const BACKEND_URL = '/api/backend';

const SENDER_LABEL: Record<string, string> = {
  ai: '🤖 IA', human: '🧑 Asesor', sequence: '🔁 Seguimiento', system: '⚙️ Sistema',
};

interface CallTranscriptTurn {
  role: string;
  text: string;
  at?: string;
}

function fmtDuration(seconds: number | null): string {
  if (!seconds && seconds !== 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default async function LeadDetail({ params }: { params: { id: string } }) {
  await requireAccess('ventas.clientes');
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

  const { data: calls } = await db
    .from('calls')
    .select('id, status, outcome, summary, duration_seconds, transcript, created_at')
    .eq('contact_id', params.id)
    .order('created_at', { ascending: false })
    .limit(50);

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
            <strong>Móvil:</strong> {c.phone || '—'}<br />
            {c.phone_home ? <><strong>Casa:</strong> {c.phone_home}<br /></> : null}
            {c.phone_work ? <><strong>Trabajo:</strong> {c.phone_work}<br /></> : null}
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
        <h3>Gestión del cliente</h3>
        <div className="row2">
          <div>
            <p style={{ marginBottom: 8, color: 'var(--muted)' }}>Seguir con el proceso: cambia la etapa.</p>
            <form action={updateStage.bind(null, c.id)} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select name="stage" defaultValue={c.stage} style={{ marginBottom: 0 }}>
                {STAGE_ORDER.map((s) => (
                  <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                ))}
              </select>
              <button type="submit">Guardar etapa</button>
            </form>
            <div style={{ marginTop: 12 }}>
              <RescoreButton contactId={c.id} stage={c.stage} backendUrl={BACKEND_URL} />
              <CallButton contactId={c.id} backendUrl={BACKEND_URL} />
            </div>
          </div>
          <div>
            <p style={{ marginBottom: 8, color: 'var(--muted)' }}>Borrar el trabajo inconcluso (no se puede deshacer).</p>
            <form action={deleteContact.bind(null, c.id)}>
              <button className="danger" type="submit">Eliminar cliente</button>
            </form>
          </div>
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

      <div className="section">
        <h3>Llamadas</h3>
        {(calls ?? []).length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>Aún no hay llamadas con este cliente.</p>
        ) : (
          <div>
            {(calls ?? []).map((call) => (
              <div key={call.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                <p style={{ marginBottom: 6 }}>
                  <strong>{call.status}</strong>
                  {' · '}Duración: {fmtDuration(call.duration_seconds)}
                  {' · '}{fmtDate(call.created_at)}
                  {call.outcome ? ` · ${call.outcome}` : ''}
                </p>
                {call.summary && (
                  <p style={{ marginBottom: 8, color: 'var(--muted)' }}>
                    <strong style={{ color: 'var(--text)' }}>Resumen:</strong> {call.summary}
                  </p>
                )}
                {Array.isArray(call.transcript) && call.transcript.length > 0 && (
                  <div>
                    {(call.transcript as CallTranscriptTurn[]).map((turn, i) => (
                      <div key={i} className={`msg ${turn.role === 'assistant' ? 'outbound' : 'inbound'}`}>
                        {turn.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
