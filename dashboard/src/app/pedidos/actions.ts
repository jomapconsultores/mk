'use server';

import { getAdmin } from '@/lib/supabase-admin';
import { requireAccess } from '@/lib/access';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const ORDER_STATUSES = ['draft', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const;
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const;

/**
 * Crea un pedido en borrador vacío (sin cliente ni líneas todavía) y va al
 * paso 1 del wizard, donde recién se elige el cliente. Mismo patrón que
 * createAgentDraft(): sin argumentos, un insert mínimo y redirect al wizard.
 */
export async function createOrderDraft() {
  const user = await requireAccess('ventas.pedidos');
  const db = getAdmin();
  const { data, error } = await db.from('orders').insert({ created_by: user.id }).select('id').single();
  if (error || !data) return;
  revalidatePath('/pedidos');
  redirect(`/pedidos/${data.id}?step=1`);
}

type ContactHit = { id: string; full_name: string | null; display_name: string | null; phone: string | null; email: string | null };

/**
 * Búsqueda de contactos para el paso 1 (Cliente). Se invoca directamente
 * desde el client component (no vía <form action>), con startTransition, tal
 * como se hace con cualquier lectura que no encaja en un submit de formulario.
 */
export async function searchContacts(query: string): Promise<ContactHit[]> {
  await requireAccess('ventas.pedidos');
  const q = query.trim().replace(/[,%]/g, ' ').trim();
  if (!q) return [];
  const db = getAdmin();
  const { data } = await db
    .from('contacts')
    .select('id, full_name, display_name, phone, email')
    .or(`full_name.ilike.%${q}%,display_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
    .limit(10);
  return (data ?? []) as ContactHit[];
}

/** Guarda cliente + datos de envío del pedido (paso 1) y avanza al paso 2. */
export async function setOrderCustomer(orderId: string, formData: FormData) {
  await requireAccess('ventas.pedidos');
  const db = getAdmin();

  const { data: existing } = await db.from('orders').select('status').eq('id', orderId).maybeSingle();
  if (!existing || existing.status !== 'draft') return; // pedido ya confirmado/cancelado: no editable

  const contactId = String(formData.get('contact_id') ?? '').trim();
  const requiresShipping = formData.get('requires_shipping') === 'on';

  const shippingAddress = requiresShipping
    ? {
        address: String(formData.get('shipping_address') ?? '').trim(),
        city: String(formData.get('shipping_city') ?? '').trim(),
        state: String(formData.get('shipping_state') ?? '').trim(),
        postal_code: String(formData.get('shipping_postal_code') ?? '').trim(),
        country: String(formData.get('shipping_country') ?? '').trim(),
        reference: String(formData.get('shipping_reference') ?? '').trim(),
      }
    : null;

  const update: Record<string, unknown> = {
    requires_shipping: requiresShipping,
    shipping_address: shippingAddress,
  };
  if (contactId) update.contact_id = contactId;

  await db.from('orders').update(update).eq('id', orderId);
  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath('/pedidos');
}

type CartLine = { productId: string; variantId: string | null; quantity: number };

/**
 * Reemplaza las líneas del pedido (paso 2: Productos). El precio, el
 * descuento y el nombre del producto/variante se resuelven ACÁ, del lado del
 * servidor, contra el catálogo real — nunca se confía en lo que mande el
 * cliente para dinero, aunque la vista del wizard ya muestre un total
 * estimado client-side para UX instantánea.
 */
export async function setOrderItems(orderId: string, items: CartLine[]) {
  await requireAccess('ventas.pedidos');
  const db = getAdmin();

  const { data: order } = await db.from('orders').select('id, status').eq('id', orderId).maybeSingle();
  if (!order || order.status !== 'draft') return; // pedido ya confirmado/cancelado: no editable

  const validItems = items.filter((i) => i.productId && i.quantity > 0);
  const productIds = [...new Set(validItems.map((i) => i.productId))];

  const { data: products } = productIds.length
    ? await db
        .from('products')
        .select('id, name, price, discount_percent, product_variants(id, sku, attributes, price, discount_percent, is_active)')
        .in('id', productIds)
        .eq('is_active', true)
    : { data: [] as any[] };

  const productMap = new Map((products ?? []).map((p: any) => [p.id, p]));

  type Resolved = {
    order_id: string;
    product_id: string;
    variant_id: string | null;
    product_name: string;
    variant_attributes: unknown;
    quantity: number;
    unit_price: number;
    discount_percent: number | null;
    subtotal: number;
    preDiscountSubtotal: number;
  };

  const resolved: Resolved[] = [];
  for (const item of validItems) {
    const product = productMap.get(item.productId);
    if (!product) continue; // producto borrado/inactivo entre que se armó el carrito y se guardó

    const variant = item.variantId
      ? ((product.product_variants ?? []) as any[]).find((v) => v.id === item.variantId && v.is_active)
      : null;

    const basePrice = variant?.price ?? product.price;
    if (basePrice == null) continue; // sin precio no hay línea que grabar

    const discount = variant?.discount_percent ?? product.discount_percent ?? null;
    const qty = Math.max(1, Math.floor(item.quantity));
    const unitPrice = discount ? Number((basePrice * (1 - discount / 100)).toFixed(2)) : Number(basePrice);

    resolved.push({
      order_id: orderId,
      product_id: item.productId,
      variant_id: variant?.id ?? null,
      product_name: product.name,
      variant_attributes: variant?.attributes ?? null,
      quantity: qty,
      unit_price: unitPrice,
      discount_percent: discount,
      subtotal: Number((unitPrice * qty).toFixed(2)),
      preDiscountSubtotal: Number((basePrice * qty).toFixed(2)),
    });
  }

  await db.from('order_items').delete().eq('order_id', orderId);
  if (resolved.length > 0) {
    await db.from('order_items').insert(
      resolved.map(({ preDiscountSubtotal: _preDiscountSubtotal, ...row }) => row),
    );
  }

  const subtotal = resolved.reduce((sum, r) => sum + r.preDiscountSubtotal, 0);
  const total = resolved.reduce((sum, r) => sum + r.subtotal, 0);
  const discountTotal = Number((subtotal - total).toFixed(2));

  await db
    .from('orders')
    .update({ subtotal: Number(subtotal.toFixed(2)), discount_total: discountTotal, total: Number(total.toFixed(2)) })
    .eq('id', orderId);

  revalidatePath(`/pedidos/${orderId}`);
  revalidatePath('/pedidos');
}

/** Guarda el método de pago (paso 3) y avanza al paso 4. */
export async function setOrderPayment(orderId: string, formData: FormData) {
  await requireAccess('ventas.pedidos');
  const db = getAdmin();
  const { data: existing } = await db.from('orders').select('status').eq('id', orderId).maybeSingle();
  if (!existing || existing.status !== 'draft') return; // pedido ya confirmado/cancelado: no editable
  const paymentMethod = String(formData.get('payment_method') ?? '').trim() || null;
  await db.from('orders').update({ payment_method: paymentMethod }).eq('id', orderId);
  revalidatePath(`/pedidos/${orderId}`);
}

/**
 * Confirma el pedido (paso 4): de 'draft' pasa a 'confirmed'. Requiere cliente
 * ya asignado y al menos una línea guardada — de lo contrario el pedido
 * quedaría "confirmado" con total $0 sin que nadie lo haya guardado a propósito.
 */
export async function confirmOrder(orderId: string) {
  await requireAccess('ventas.pedidos');
  const db = getAdmin();
  const { data: order } = await db.from('orders').select('contact_id, status').eq('id', orderId).maybeSingle();
  if (!order || !order.contact_id || order.status !== 'draft') return;

  const { count } = await db
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId);
  if (!count) return; // sin líneas: no se puede confirmar un pedido vacío

  await db.from('orders').update({ status: 'confirmed' }).eq('id', orderId).eq('status', 'draft');
  revalidatePath('/pedidos');
  revalidatePath(`/pedidos/${orderId}`);
}

/** Cambia el estado logístico de un pedido ya existente (fuera del wizard de creación). */
export async function updateOrderStatus(orderId: string, status: string) {
  await requireAccess('ventas.pedidos');
  if (!(ORDER_STATUSES as readonly string[]).includes(status)) return;
  const db = getAdmin();
  await db.from('orders').update({ status }).eq('id', orderId);
  revalidatePath('/pedidos');
  revalidatePath(`/pedidos/${orderId}`);
}

/** Cambia el estado de pago de un pedido ya existente (independiente del estado logístico). */
export async function updateOrderPaymentStatus(orderId: string, paymentStatus: string) {
  await requireAccess('ventas.pedidos');
  if (!(PAYMENT_STATUSES as readonly string[]).includes(paymentStatus)) return;
  const db = getAdmin();
  await db.from('orders').update({ payment_status: paymentStatus }).eq('id', orderId);
  revalidatePath('/pedidos');
  revalidatePath(`/pedidos/${orderId}`);
}

/** Cancela un pedido. No lo borra (queda como historial), solo cambia su estado. */
export async function cancelOrder(orderId: string) {
  await requireAccess('ventas.pedidos');
  const db = getAdmin();
  await db.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
  revalidatePath('/pedidos');
  redirect('/pedidos');
}
