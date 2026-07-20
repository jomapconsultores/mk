import { getAdmin } from '@/lib/supabase-admin';
import { requireAccess } from '@/lib/access';
import { STAGE_LABELS, STAGE_COLORS, INTEREST_LABELS, fmtDate, searchTerm, waLink } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: { stage?: string; q?: string; needs_human?: string };
}) {
  await requireAccess('ventas.clientes');
  const db = getAdmin();
  const q = searchTerm(searchParams.q);
  const onlyNeedsHuman = searchParams.needs_human === '1';

  let query = db
    .from('contacts')
    .select('id, display_name, full_name, phone, stage, interest_level, lead_score, source_channel, last_inbound_at, marketing_opted_out, needs_human')
    // Quien pidió hablar con una persona va primero SIEMPRE: se le prometió por
    // escrito que alguien le escribiría.
    .order('needs_human', { ascending: false })
    .order('lead_score', { ascending: false })
    .limit(200);

  if (searchParams.stage) query = query.eq('stage', searchParams.stage);
  if (onlyNeedsHuman) query = query.eq('needs_human', true);
  // Con búsqueda, el .limit(200) por score deja de ser un problema: el cliente
  // que llama se encuentra por nombre o teléfono aunque tenga score bajo.
  if (q) query = query.or(`full_name.ilike.%${q}%,display_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);

  const { data: contacts } = await query;

  // Contador del aviso, independiente de los filtros activos.
  const { count: needsHumanCount } = await db
    .from('contacts')
    .select('id', { count: 'exact', head: true })
    .eq('needs_human', true);

  return (
    <>
      <h2>Clientes</h2>
      <p className="subtitle">Ordenados por probabilidad de compra (score). Haz clic para ver la conversación.</p>

      {!!needsHumanCount && (
        <a
          href="/leads?needs_human=1"
          className="badge"
          style={{ background: '#ef4444', display: 'inline-block', marginBottom: 14, padding: '7px 14px', fontSize: 13 }}
        >
          🔔 {needsHumanCount} {needsHumanCount === 1 ? 'cliente espera' : 'clientes esperan'} atención humana
        </a>
      )}

      <form method="get" style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {searchParams.stage && <input type="hidden" name="stage" value={searchParams.stage} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, teléfono o email…"
          style={{ flex: 1, minWidth: 220, maxWidth: 380 }}
        />
        <button type="submit">Buscar</button>
        {(q || onlyNeedsHuman) && <a href="/leads" className="badge" style={{ background: '#475569', alignSelf: 'center' }}>Limpiar</a>}
      </form>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a href="/leads" className="badge" style={{ background: '#475569' }}>Todos</a>
        {Object.entries(STAGE_LABELS).map(([k, label]) => (
          <a key={k} href={`/leads?stage=${k}`} className="badge" style={{ background: STAGE_COLORS[k] }}>{label}</a>
        ))}
      </div>

      <table>
        <thead>
          <tr><th>Cliente</th><th>Etapa</th><th>Interés</th><th>Score</th><th>Canal</th><th>Último mensaje</th><th>Contactar</th></tr>
        </thead>
        <tbody>
          {(contacts ?? []).map((c) => {
            const wa = waLink(c.phone);
            return (
              <tr key={c.id}>
                <td>
                  <a href={`/leads/${c.id}`}>{c.display_name || c.full_name || c.phone || 'Sin nombre'}</a>
                  {c.needs_human && <span className="badge" style={{ background: '#ef4444', marginLeft: 8, fontSize: 10 }}>PIDE HUMANO</span>}
                  {c.marketing_opted_out && <span style={{ color: '#ef4444', marginLeft: 8, fontSize: 11 }}>● baja</span>}
                </td>
                <td><span className="badge" style={{ background: STAGE_COLORS[c.stage] }}>{STAGE_LABELS[c.stage] ?? c.stage}</span></td>
                <td>{c.interest_level ? INTEREST_LABELS[c.interest_level] : '—'}</td>
                <td>
                  <span className="score-bar"><span style={{ width: `${c.lead_score}%` }} /></span> {c.lead_score}
                </td>
                <td>{c.source_channel ?? '—'}</td>
                <td>{fmtDate(c.last_inbound_at)}</td>
                <td>
                  {wa
                    ? <a href={wa} target="_blank" rel="noopener noreferrer" title={c.phone ?? ''}>💬 WhatsApp</a>
                    : <span style={{ color: 'var(--muted)' }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {(!contacts || contacts.length === 0) && (
        <p className="empty">
          {q ? `Ningún cliente coincide con “${q}”.` : 'No hay clientes en esta vista todavía.'}
        </p>
      )}
    </>
  );
}
