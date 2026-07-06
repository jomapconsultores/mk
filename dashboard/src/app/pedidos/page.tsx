import { getAdmin } from '@/lib/supabase-admin';
import { requireAccess } from '@/lib/access';
import { fmtDate, money } from '@/lib/format';
import { createOrderDraft } from './actions';

export const dynamic = 'force-dynamic';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  confirmed: 'Confirmado',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};
const STATUS_COLORS: Record<string, string> = {
  draft: '#64748b',
  confirmed: '#6366f1',
  shipped: '#0ea5e9',
  delivered: '#22c55e',
  cancelled: '#ef4444',
};
const PAYMENT_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  failed: 'Fallido',
  refunded: 'Reembolsado',
};
const PAYMENT_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  paid: '#22c55e',
  failed: '#ef4444',
  refunded: '#64748b',
};

type OrderRow = {
  id: string;
  order_number: number;
  status: string;
  payment_status: string;
  total: number;
  currency: string;
  created_at: string;
  contacts: { full_name: string | null; display_name: string | null } | null;
  order_items: { id: string }[];
};

export default async function OrdersPage() {
  await requireAccess('ventas.pedidos');
  const db = getAdmin();
  const { data: orders } = await db
    .from('orders')
    .select(
      'id, order_number, status, payment_status, total, currency, created_at, contacts(full_name, display_name), order_items(id)',
    )
    .order('created_at', { ascending: false });

  const rows = (orders ?? []) as unknown as OrderRow[];

  return (
    <>
      <h2>Pedidos</h2>
      <p className="subtitle">Pedidos de clientes: productos, envío, pago y estado.</p>

      <div className="section">
        <h3>Nuevo pedido</h3>
        <p style={{ color: 'var(--muted)', marginBottom: 12, fontSize: 13 }}>
          Crea el borrador y te lleva directo a elegir cliente y productos.
        </p>
        <form action={createOrderDraft}>
          <button type="submit">+ Nuevo pedido</button>
        </form>
      </div>

      <div className="section">
        <h3>Listado</h3>
        <table>
          <thead>
            <tr>
              <th>N° Pedido</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th>Pago</th>
              <th>Total</th>
              <th>Artículos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td>#{o.order_number}</td>
                <td>{fmtDate(o.created_at)}</td>
                <td>{o.contacts?.display_name || o.contacts?.full_name || '—'}</td>
                <td>
                  <span className="badge" style={{ background: STATUS_COLORS[o.status] ?? '#64748b' }}>
                    {STATUS_LABELS[o.status] ?? o.status}
                  </span>
                </td>
                <td>
                  <span className="badge" style={{ background: PAYMENT_COLORS[o.payment_status] ?? '#64748b' }}>
                    {PAYMENT_LABELS[o.payment_status] ?? o.payment_status}
                  </span>
                </td>
                <td>{money(o.total, o.currency)}</td>
                <td>{o.order_items?.length ?? 0}</td>
                <td>
                  <a href={`/pedidos/${o.id}`} className="badge" style={{ background: '#6366f1' }}>
                    Ver
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="empty">Aún no hay pedidos. Crea el primero arriba ☝️</p>}
      </div>
    </>
  );
}
