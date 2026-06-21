import { getAdmin } from '@/lib/supabase-admin';
import ImportDropzone from './ImportDropzone';

export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL ?? 'https://marketing-map.onrender.com';

const STATUS_LABEL: Record<string, string> = {
  new:        'Nuevo',
  qualifying: 'Calificando',
  qualified:  'Calificado',
  outreach:   'En contacto',
  responded:  'Respondió',
  converted:  'Convertido',
  discarded:  'Descartado',
};

const STATUS_COLOR: Record<string, string> = {
  new:        '#64748b',
  qualifying: '#a855f7',
  qualified:  '#3b82f6',
  outreach:   '#f59e0b',
  responded:  '#10b981',
  converted:  '#22c55e',
  discarded:  '#ef4444',
};

export default async function ProspeccionPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const db = getAdmin();
  const filterStatus = searchParams.status ?? '';

  // Conteos por estado (pipeline)
  const { data: allStatuses } = await db.from('prospects').select('status');
  const counts: Record<string, number> = {};
  for (const r of allStatuses ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // Lista de prospectos
  let q = db
    .from('prospects')
    .select('id, full_name, company, email, phone, industry, location, fit_score, status, ai_profile_summary, outreach_angle, created_at')
    .order('fit_score', { ascending: false })
    .limit(200);
  if (filterStatus) q = q.eq('status', filterStatus);
  const { data: prospects } = await q;

  // Campañas activas
  const { data: campaigns } = await db
    .from('outreach_campaigns')
    .select('id, name, is_active, daily_limit, channel_order')
    .order('created_at');

  // Mensajes enviados esta semana
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { count: sentThisWeek } = await db
    .from('outreach_messages')
    .select('id', { count: 'exact', head: true })
    .gte('sent_at', weekAgo);

  return (
    <>
      <h2>Prospección activa</h2>
      <p className="subtitle">
        Busca, califica y convierte prospectos de forma natural y multicanal.
      </p>

      {/* Importador inteligente con drag & drop */}
      <div className="section" style={{ marginBottom: 24 }}>
        <ImportDropzone backendUrl={BACKEND_URL} />
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {Object.entries(STATUS_LABEL).map(([key, label]) => (
          <a key={key} href={`/prospeccion?status=${key}`} style={{ textDecoration: 'none' }}>
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 20px', minWidth: 110, cursor: 'pointer' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: STATUS_COLOR[key] }}>{counts[key] ?? 0}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
            </div>
          </a>
        ))}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 20px', minWidth: 110 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#818cf8' }}>{sentThisWeek ?? 0}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Enviados (7d)</div>
        </div>
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 20px', minWidth: 110 }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{total}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Total prospectos</div>
        </div>
      </div>

      {/* Campañas */}
      <div className="section" style={{ marginBottom: 24 }}>
        <h3>Campañas de outreach</h3>
        {campaigns && campaigns.length > 0 ? (
          <table>
            <thead>
              <tr><th>Campaña</th><th>Canales</th><th>Límite diario</th><th>Estado</th></tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td style={{ fontSize: 12 }}>{(c.channel_order as string[]).join(' → ')}</td>
                  <td>{c.daily_limit} / día</td>
                  <td>
                    <span className="badge" style={{ background: c.is_active ? '#22c55e' : '#64748b' }}>
                      {c.is_active ? 'Activa' : 'Pausada'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="empty">No hay campañas creadas. Ejecuta la migración <code>db/add_prospecting.sql</code>.</p>
        )}
      </div>

      {/* Filtros de estado */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a href="/prospeccion" className="badge" style={{ background: '#475569' }}>Todos</a>
        {Object.entries(STATUS_LABEL).map(([k, label]) => (
          <a key={k} href={`/prospeccion?status=${k}`} className="badge" style={{ background: STATUS_COLOR[k] }}>{label}</a>
        ))}
      </div>

      {/* Tabla de prospectos */}
      <table>
        <thead>
          <tr>
            <th>Prospecto</th>
            <th>Empresa / Industria</th>
            <th>Contacto</th>
            <th>Score</th>
            <th>Ángulo de entrada</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {(prospects ?? []).map((p) => (
            <tr key={p.id}>
              <td>
                <strong>{p.full_name ?? '—'}</strong>
                {p.ai_profile_summary && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{p.ai_profile_summary}</div>
                )}
              </td>
              <td>
                {p.company && <div>{p.company}</div>}
                {p.industry && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.industry}</div>}
                {p.location && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{p.location}</div>}
              </td>
              <td style={{ fontSize: 12 }}>
                {p.email && <div>{p.email}</div>}
                {p.phone && <div>{p.phone}</div>}
              </td>
              <td>
                {p.fit_score != null ? (
                  <>
                    <span className="score-bar"><span style={{ width: `${p.fit_score}%` }} /></span> {p.fit_score}
                  </>
                ) : '—'}
              </td>
              <td style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 200 }}>
                {p.outreach_angle ?? '—'}
              </td>
              <td>
                <span className="badge" style={{ background: STATUS_COLOR[p.status] ?? '#64748b' }}>
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {(!prospects || prospects.length === 0) && (
        <p className="empty">
          No hay prospectos en esta vista.{' '}
          {!filterStatus && 'Importa una lista CSV o configura un scraping de Google Maps.'}
        </p>
      )}

      {/* Instrucciones rápidas */}
      <div className="section" style={{ marginTop: 32 }}>
        <h3>Cómo agregar prospectos</h3>
        <p style={{ color: 'var(--muted)', marginBottom: 12 }}>
          El backend expone estos endpoints (protegidos con tu <code>CRON_SECRET</code>):
        </p>
        <table>
          <thead><tr><th>Método</th><th>Endpoint</th><th>Qué hace</th></tr></thead>
          <tbody>
            <tr><td><code>POST</code></td><td><code>/prospecting/import-csv</code></td><td>Importa CSV de prospectos y los califica con IA</td></tr>
            <tr><td><code>POST</code></td><td><code>/prospecting/scrape-google</code></td><td>Busca negocios en Google Maps y los guarda</td></tr>
            <tr><td><code>POST</code></td><td><code>/prospecting/qualify</code></td><td>Califica prospectos 'new' pendientes con IA</td></tr>
            <tr><td><code>POST</code></td><td><code>/cron/run-prospecting</code></td><td>Ejecuta el motor (inscribir + enviar mensajes)</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
