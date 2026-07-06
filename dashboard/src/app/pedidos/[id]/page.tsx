import { getAdmin } from '@/lib/supabase-admin';
import { requireAccess } from '@/lib/access';
import OrderWizard, { type Order, type Product } from '../OrderWizard';

export const dynamic = 'force-dynamic';

export default async function OrderWizardPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { step?: string };
}) {
  await requireAccess('ventas.pedidos');
  const db = getAdmin();

  const { data: order } = await db
    .from('orders')
    .select(
      `
      id, order_number, status, payment_status, payment_method, requires_shipping,
      shipping_address, currency, subtotal, discount_total, total, notes, contact_id,
      contacts ( id, full_name, display_name, phone, email ),
      order_items ( id, product_id, variant_id, product_name, variant_attributes, quantity, unit_price, discount_percent, subtotal )
    `,
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!order) return <p className="empty">Pedido no encontrado.</p>;

  // Catálogo activo para el paso 2 (Productos). product_variants lo crea una
  // migración separada (db/add_product_variants.sql, fuera de este alcance);
  // si un producto no tiene variantes, product_variants viene vacío ([]) y el
  // wizard lo trata como su propia variante única (mismo criterio que el
  // resto del panel).
  const { data: products } = await db
    .from('products')
    .select(
      'id, name, kind, price, currency, discount_percent, product_variants(id, sku, attributes, price, discount_percent, is_active)',
    )
    .eq('is_active', true)
    .order('name');

  const rawStep = Number(searchParams.step ?? '1');
  const initialStep = Number.isFinite(rawStep) ? Math.min(4, Math.max(1, rawStep)) : 1;

  return (
    <>
      <p style={{ marginBottom: 12 }}>
        <a href="/pedidos">← Volver a pedidos</a>
      </p>
      <h2>Pedido #{order.order_number}</h2>
      <p className="subtitle">Completá cliente, productos, pago y confirmá el pedido.</p>
      <OrderWizard order={order as unknown as Order} products={(products ?? []) as unknown as Product[]} initialStep={initialStep} />
    </>
  );
}
