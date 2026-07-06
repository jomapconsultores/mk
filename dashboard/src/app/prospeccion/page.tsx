import { getAdmin } from '@/lib/supabase-admin';
import { requireAccess } from '@/lib/access';
import ImportDropzone from './ImportDropzone';
import CsvImporter from './CsvImporter';
import QualifyButton from './QualifyButton';

export const dynamic = 'force-dynamic';

// Proxy autenticado (server-side) hacia el backend real — ver
// src/app/api/backend/[...path]/route.ts. QualifyButton/ImportDropzone llaman
// desde el navegador a esta ruta local, nunca al backend real directo
// (/prospecting/qualify e /import-smart ahora requieren el secreto interno).
const BACKEND_URL = '/api/backend';

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
  searchParams: { tab?: string; status?: string; rama?: string; ok?: string; dup?: string; err?: string };
}) {
  await requireAccess('captacion.prospeccion');
  const db = getAdmin();
  const activeTab = searchParams.tab ?? 'pipeline';

  // ── Pipeline data ────────────────────────────────────────────
  const filterStatus = searchParams.status ?? '';
  const filterRama   = searchParams.rama   ?? '';

  const { data: allStatuses } = await db.from('prospects').select('status');
  const counts: Record<string, number> = {};
  for (const r of allStatuses ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  let q = db
    .from('prospects')
    .select('id, full_name, company, email, phone, industry, location, fit_score, status, ai_profile_summary, outreach_angle, raw_data, created_at')
    .order('fit_score', { ascending: false })
    .limit(200);
  if (filterStatus) q = q.eq('status', filterStatus);
  const { data: prospects } = await q;

  // Filtrar por rama en memoria (raw_data es JSONB — no se puede filtrar directamente con el cliente)
  const prospectsFiltrados = filterRama
    ? (prospects ?? []).filter((p: any) => p.raw_data?.etiqueta_crm === filterRama || p.raw_data?.rama === filterRama)
    : (prospects ?? []);

  const { data: campaigns } = await db
    .from('outreach_campaigns')
    .select('id, name, is_active, daily_limit, channel_order')
    .order('created_at');

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { count: sentThisWeek } = await db
    .from('outreach_messages')
    .select('id', { count: 'exact', head: true })
    .gte('sent_at', weekAgo);

  // ── CSV feedback ─────────────────────────────────────────────
  const csvOk  = searchParams.ok;
  const csvDup = searchParams.dup;
  const csvErr = searchParams.err;
  const csvErrorMsg =
    csvErr === 'consent' ? 'Debes confirmar que tienes el consentimiento de los contactos.'
    : csvErr === 'empty' ? 'No se encontraron contactos válidos. Revisa que el archivo tenga encabezado y datos.'
    : null;

  return (
    <>
      <h2>Prospección · Importar</h2>
      <p className="subtitle">
        Importa tu base de contactos, busca nuevos prospectos con IA y gestiona todo el pipeline de conversión.
      </p>

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'pipeline',  label: '📊 Pipeline' },
          { id: 'ia',        label: '🤖 Importar con IA' },
          { id: 'csv',       label: '📋 Importar CSV' },
        ].map(t => (
          <a
            key={t.id}
            href={`/prospeccion?tab=${t.id}`}
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
              borderBottom: activeTab === t.id ? '2px solid var(--accent, #4f46e5)' : '2px solid transparent',
              color: activeTab === t.id ? 'var(--accent, #4f46e5)' : 'var(--muted)',
              transition: 'all .15s',
            }}
          >
            {t.label}
          </a>
        ))}
      </div>

      {/* ── Tab: Pipeline ──────────────────────────────────────── */}
      {activeTab === 'pipeline' && (
        <>
          {/* KPIs */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            {Object.entries(STATUS_LABEL).map(([key, label]) => (
              <a key={key} href={`/prospeccion?tab=pipeline&status=${key}`} style={{ textDecoration: 'none' }}>
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

          {/* Botón de calificación masiva */}
          <QualifyButton
            pendingCount={(counts['new'] ?? 0) + (counts['qualifying'] ?? 0)}
            backendUrl={BACKEND_URL}
          />

          {/* Filtros por estado */}
          <div style={{ marginBottom: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Estado:</span>
            <a href="/prospeccion?tab=pipeline" className="badge" style={{ background: '#475569' }}>Todos</a>
            {Object.entries(STATUS_LABEL).map(([k, label]) => (
              <a key={k} href={`/prospeccion?tab=pipeline&status=${k}${filterRama ? `&rama=${filterRama}` : ''}`} className="badge" style={{ background: STATUS_COLOR[k] }}>{label}</a>
            ))}
          </div>

          {/* Filtros por rama / producto */}
          <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Rama:</span>
            {[
              { id: '',            label: 'Todas las ramas',   color: '#475569' },
              { id: 'marketing',   label: '🌐 Marketing MAP',   color: '#4f46e5' },
              { id: 'tributaria',  label: '📊 Tributaria',      color: '#0891b2' },
              { id: 'educacion',   label: '🎓 Educación',       color: '#7c3aed' },
              { id: 'idiomas',     label: '🇬🇧 Idiomas',        color: '#059669' },
              { id: 'salud_mental',label: '🧠 Salud mental',    color: '#be185d' },
              { id: 'firma_digital',label:'🔏 Firma digital',   color: '#b45309' },
              { id: 'general',     label: '📁 General',         color: '#64748b' },
            ].map(r => (
              <a key={r.id} href={`/prospeccion?tab=pipeline${r.id ? `&rama=${r.id}` : ''}${filterStatus ? `&status=${filterStatus}` : ''}`}
                className="badge"
                style={{ background: filterRama === r.id || (!filterRama && !r.id) ? r.color : 'var(--panel-2)', color: filterRama === r.id || (!filterRama && !r.id) ? '#fff' : 'var(--muted)', border: '1px solid var(--border)' }}>
                {r.label}
              </a>
            ))}
          </div>

          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
            Mostrando <strong>{prospectsFiltrados.length}</strong> prospectos{filterRama ? ` en rama "${filterRama}"` : ''}
          </div>

          {/* Tabla de prospectos */}
          <table>
            <thead>
              <tr>
                <th>Prospecto</th>
                <th>Empresa / Industria</th>
                <th>Contacto</th>
                <th>Score</th>
                <th>Rama · Producto objetivo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {prospectsFiltrados.map((p: any) => (
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
                  <td style={{ fontSize: 11 }}>
                    {p.raw_data?.rama ? (
                      <div>
                        <span className="badge" style={{ background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: 10 }}>
                          {p.raw_data.rama}
                        </span>
                        {p.raw_data?.producto_objetivo && (
                          <div style={{ color: 'var(--muted)', marginTop: 2 }}>{p.raw_data.producto_objetivo}</div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>{p.outreach_angle ?? '—'}</span>
                    )}
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

          {prospectsFiltrados.length === 0 && (
            <p className="empty">
              No hay prospectos en esta vista.{' '}
              {!filterStatus && !filterRama && (
                <>Usa <a href="/captacion">Captación activa</a>, <a href="/prospeccion?tab=ia">Importar con IA</a> o <a href="/prospeccion?tab=csv">Importar CSV</a>.</>
              )}
            </p>
          )}
        </>
      )}

      {/* ── Tab: Importar con IA ────────────────────────────────── */}
      {activeTab === 'ia' && (
        <div className="section">
          <ImportDropzone backendUrl={BACKEND_URL} />
        </div>
      )}

      {/* ── Tab: Importar CSV ───────────────────────────────────── */}
      {activeTab === 'csv' && (
        <>
          {csvOk !== undefined && (
            <div className="section" style={{ borderColor: '#bbf7d0', background: '#f0fdf4', marginBottom: 20 }}>
              ✅ <strong>{csvOk}</strong> contactos importados correctamente.
              {csvDup && Number(csvDup) > 0
                ? <> Se omitieron <strong>{csvDup}</strong> duplicados (ya existían en el sistema).</>
                : null}
            </div>
          )}
          {csvErrorMsg && (
            <div className="section" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c', marginBottom: 20 }}>
              ⚠️ {csvErrorMsg}
            </div>
          )}
          <div className="section">
            <CsvImporter />
          </div>
          <div className="section">
            <h3>Columnas que reconoce automáticamente</h3>
            <p style={{ color: 'var(--muted)', marginBottom: 12, fontSize: 13 }}>
              La primera fila debe ser el encabezado. Se detectan en cualquier orden e idioma:
            </p>
            <table>
              <thead>
                <tr><th>Campo</th><th>Nombres de columna aceptados</th></tr>
              </thead>
              <tbody>
                <tr><td>Nombre completo</td><td><code>nombre, name, cliente, contacto, completo</code></td></tr>
                <tr><td>Correo electrónico</td><td><code>email, correo, mail</code></td></tr>
                <tr><td>Celular / WhatsApp</td><td><code>movil, celular, cel, whatsapp, telefono, phone</code></td></tr>
                <tr><td>Teléfono convencional</td><td><code>casa, domicilio, hogar, home</code></td></tr>
                <tr><td>Teléfono trabajo</td><td><code>trabajo, oficina, work, laboral</code></td></tr>
              </tbody>
            </table>
            <p style={{ marginTop: 14, fontSize: 13, color: 'var(--muted)' }}>
              Ejemplo de primera fila:{' '}
              <code style={{ background: 'var(--panel-2)', padding: '2px 6px', borderRadius: 6 }}>
                nombre,correo,celular,casa,trabajo
              </code>
            </p>
          </div>
        </>
      )}
    </>
  );
}
