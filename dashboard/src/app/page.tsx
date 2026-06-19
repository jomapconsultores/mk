import { getAdmin } from '@/lib/supabase-admin';
import { STAGE_LABELS, STAGE_COLORS, STAGE_ORDER } from '@/lib/format';

export const dynamic = 'force-dynamic';

async function countWhere(table: string, build: (q: any) => any): Promise<number> {
  const db = getAdmin();
  let q = db.from(table).select('id', { count: 'exact', head: true });
  q = build(q);
  const { count } = await q;
  return count ?? 0;
}

export default async function Dashboard() {
  const db = getAdmin();

  const total = await countWhere('contacts', (q) => q);
  const optedOut = await countWhere('contacts', (q) => q.eq('marketing_opted_out', true));
  const customers = await countWhere('contacts', (q) => q.eq('stage', 'customer'));

  // Conteo por etapa
  const byStage: Record<string, number> = {};
  for (const s of STAGE_ORDER) {
    byStage[s] = await countWhere('contacts', (q) => q.eq('stage', s));
  }

  // Leads creados hoy
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const newToday = await countWhere('contacts', (q) => q.gte('created_at', startOfDay.toISOString()));

  // Mensajes (volumen)
  const { count: msgCount } = await db.from('messages').select('id', { count: 'exact', head: true });

  return (
    <>
      <h2>Tablero</h2>
      <p className="subtitle">Resumen de tu captación de clientes en tiempo real.</p>

      <div className="cards">
        <div className="card"><div className="num">{total}</div><div className="lbl">Clientes totales</div></div>
        <div className="card"><div className="num">{newToday}</div><div className="lbl">Nuevos hoy</div></div>
        <div className="card"><div className="num">{customers}</div><div className="lbl">Clientes ganados</div></div>
        <div className="card"><div className="num">{msgCount ?? 0}</div><div className="lbl">Mensajes</div></div>
        <div className="card"><div className="num">{optedOut}</div><div className="lbl">Dados de baja</div></div>
      </div>

      <div className="section">
        <h3>Embudo por etapa</h3>
        <table>
          <thead><tr><th>Etapa</th><th>Clientes</th><th></th></tr></thead>
          <tbody>
            {STAGE_ORDER.map((s) => {
              const n = byStage[s];
              const pct = total ? Math.round((n / total) * 100) : 0;
              return (
                <tr key={s}>
                  <td><span className="badge" style={{ background: STAGE_COLORS[s] }}>{STAGE_LABELS[s]}</span></td>
                  <td>{n}</td>
                  <td>
                    <span className="score-bar"><span style={{ width: `${pct}%`, background: STAGE_COLORS[s] }} /></span>
                    {' '}{pct}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {total === 0 && (
        <p className="empty">
          Aún no hay clientes. En cuanto conectes WhatsApp y lleguen mensajes, aparecerán aquí
          clasificados automáticamente.
        </p>
      )}
    </>
  );
}
