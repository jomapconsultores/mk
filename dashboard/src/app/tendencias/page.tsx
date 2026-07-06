import { getAdmin } from '@/lib/supabase-admin';
import { getTrends } from '@/lib/trends';

export const dynamic = 'force-dynamic';

type Row = { label: string; n: number };

function countBy<T>(arr: T[], key: (x: T) => string): Row[] {
  const m = new Map<string, number>();
  for (const x of arr) {
    const k = key(x);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n);
}

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', facebook: 'Facebook',
  email: 'Email', web: 'Web / Landing', sms: 'SMS', desconocido: 'Desconocido',
};

function Bars({ rows, empty }: { rows: Row[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <p style={{ color: 'var(--muted)' }}>{empty}</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 40px', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13 }}>{r.label}</span>
          <span style={{ background: 'var(--border)', borderRadius: 999, height: 12, overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${(r.n / max) * 100}%`, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)' }} />
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{r.n}</span>
        </div>
      ))}
    </div>
  );
}

export default async function Tendencias() {
  const db = getAdmin();
  const [{ data: contacts }, { data: products }, { data: msgs }, trends] = await Promise.all([
    db
      .from('contacts')
      .select('created_at, source_channel, interested_product_id, marketing_opted_out, stage, interest_level')
      .limit(5000),
    db.from('products').select('id, name'),
    db.from('messages').select('ai_intent').eq('direction', 'inbound').limit(5000),
    getTrends('EC'),
  ]);

  const C = contacts ?? [];
  const total = C.length;
  const customers = C.filter((c) => c.stage === 'customer').length;
  const optedOut = C.filter((c) => c.marketing_opted_out).length;
  const conv = total ? Math.round((customers / total) * 100) : 0;
  const churn = total ? Math.round((optedOut / total) * 100) : 0;

  const prodName: Record<string, string> = Object.fromEntries((products ?? []).map((p) => [p.id, p.name]));
  const bySource = countBy(C, (c) => CHANNEL_LABEL[c.source_channel ?? 'desconocido'] ?? c.source_channel ?? 'Desconocido');
  const byProduct = countBy(C.filter((c) => c.interested_product_id), (c) => prodName[c.interested_product_id as string] ?? 'Otro');
  const byIntent = countBy((msgs ?? []).filter((m) => m.ai_intent), (m) => m.ai_intent as string);

  // Leads de los últimos 14 días
  const countByDay = new Map<string, number>();
  for (const c of C) {
    const key = (c.created_at ?? '').slice(0, 10);
    if (!key) continue;
    countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
  }
  const days: { d: string; n: number }[] = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const key = day.toISOString().slice(0, 10);
    const n = countByDay.get(key) ?? 0;
    days.push({ d: key.slice(5), n });
  }
  const maxDay = Math.max(1, ...days.map((x) => x.n));

  return (
    <>
      <h2>Tendencias</h2>
      <p className="subtitle">Insights de tus propios datos (sin vigilar a nadie): de dónde vienen, qué les interesa y cómo convierten.</p>

      <div className="cards">
        <div className="card"><div className="num">{total}</div><div className="lbl">Leads analizados</div></div>
        <div className="card"><div className="num">{conv}%</div><div className="lbl">Conversión a cliente</div></div>
        <div className="card"><div className="num">{customers}</div><div className="lbl">Clientes ganados</div></div>
        <div className="card"><div className="num">{churn}%</div><div className="lbl">Tasa de baja</div></div>
      </div>

      <div className="section">
        <h3>Leads — últimos 14 días</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, marginTop: 10 }}>
          {days.map((x) => (
            <div key={x.d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{x.n || ''}</span>
              <div title={`${x.d}: ${x.n}`} style={{ width: '100%', height: `${(x.n / maxDay) * 100}%`, minHeight: x.n ? 4 : 0, background: 'linear-gradient(180deg,#818cf8,#6366f1)', borderRadius: '6px 6px 0 0' }} />
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>{x.d}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="row2">
        <div className="section">
          <h3>Origen de los leads</h3>
          <Bars rows={bySource} empty="Aún no hay datos de origen." />
        </div>
        <div className="section">
          <h3>Productos con más interés</h3>
          <Bars rows={byProduct} empty="Aún no hay interés registrado por producto." />
        </div>
      </div>

      <div className="section">
        <h3>¿Qué piden los clientes? (intención detectada por la IA)</h3>
        <Bars rows={byIntent} empty="Aún no hay mensajes analizados." />
      </div>

      <div className="section">
        <h3>🌎 Tendencias públicas en Ecuador (Google · hoy)</h3>
        <p style={{ color: 'var(--muted)', marginBottom: 14, fontSize: 13 }}>
          Lo que está buscando la gente ahora mismo. Úsalo como idea para tu contenido y campañas.
          Datos públicos y agregados (no se rastrea a personas). Se actualiza cada hora.
        </p>
        {trends.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No se pudieron cargar las tendencias en este momento.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {trends.map((t, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontWeight: 700, color: 'var(--muted)', width: 22 }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{t.title}</div>
                  {t.newsTitle && t.newsUrl && (
                    <a href={t.newsUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5 }}>
                      {t.newsTitle}
                    </a>
                  )}
                </div>
                {t.traffic && <span className="badge" style={{ background: '#6366f1' }}>{t.traffic}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <p style={{ color: 'var(--muted)', fontSize: 12 }}>
        * Basado en hasta 5.000 registros recientes. Para análisis de tendencias públicas externas
        (ej. Google Trends) podemos sumar una integración más adelante.
      </p>
    </>
  );
}
