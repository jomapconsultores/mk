'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { money } from '@/lib/format';
import {
  cancelOrder,
  confirmOrder,
  searchContacts,
  setOrderCustomer,
  setOrderItems,
  setOrderPayment,
  updateOrderPaymentStatus,
  updateOrderStatus,
} from './actions';

const STEP_LABELS = ['Cliente', 'Productos', 'Pago', 'Revisar'];

const STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador',
  confirmed: 'Confirmado',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};
const PAYMENT_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  failed: 'Fallido',
  refunded: 'Reembolsado',
};
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
};

export type Contact = {
  id: string;
  full_name: string | null;
  display_name: string | null;
  phone: string | null;
  email: string | null;
};

export type ShippingAddress = {
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  reference?: string;
} | null;

export type OrderItemRecord = {
  id: string;
  product_id: string;
  variant_id: string | null;
  product_name: string;
  variant_attributes: Record<string, string> | null;
  quantity: number;
  unit_price: number;
  discount_percent: number | null;
  subtotal: number;
};

export type Order = {
  id: string;
  order_number: number;
  status: 'draft' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_method: string | null;
  requires_shipping: boolean;
  shipping_address: ShippingAddress;
  currency: string;
  subtotal: number;
  discount_total: number;
  total: number;
  notes: string | null;
  contact_id: string | null;
  contacts: Contact | null;
  order_items: OrderItemRecord[];
};

export type ProductVariant = {
  id: string;
  sku: string | null;
  attributes: Record<string, string>;
  price: number | null;
  discount_percent: number | null;
  is_active: boolean;
};

export type Product = {
  id: string;
  name: string;
  kind: string;
  price: number | null;
  currency: string;
  discount_percent: number | null;
  product_variants: ProductVariant[];
};

type CartLine = {
  productId: string;
  variantId: string | null;
  name: string;
  attrLabel: string;
  unitPrice: number;
  qty: number;
};

function contactLabel(c: Contact | null): string {
  if (!c) return '—';
  return c.display_name || c.full_name || c.phone || c.email || '—';
}

function attrsLabel(attrs: Record<string, string> | null | undefined): string {
  if (!attrs) return '';
  return Object.values(attrs).filter(Boolean).join(' / ');
}

function effectivePrice(basePrice: number | null, baseDiscount: number | null, variant?: ProductVariant | null): number | null {
  const price = variant?.price ?? basePrice;
  const discount = variant?.discount_percent ?? baseDiscount;
  if (price == null) return null;
  return discount ? Number((price * (1 - discount / 100)).toFixed(2)) : price;
}

function formatShippingAddress(addr: ShippingAddress): string {
  if (!addr) return '—';
  return [addr.address, addr.city, addr.state, addr.postal_code, addr.country]
    .filter(Boolean)
    .join(', ') || '—';
}

export default function OrderWizard({
  order,
  products,
  initialStep,
}: {
  order: Order;
  products: Product[];
  initialStep: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [step, setStep] = useState(initialStep);
  const [status, setStatus] = useState(order.status);

  // --- Paso 1: Cliente ---
  const [contact, setContact] = useState<Contact | null>(order.contacts);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Contact[]>([]);
  const [requiresShipping, setRequiresShipping] = useState(order.requires_shipping);

  useEffect(() => {
    if (contact || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      startTransition(async () => {
        const hits = await searchContacts(query);
        setResults(hits);
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [query, contact]);

  // --- Paso 2: Productos ---
  const [items, setItems] = useState<CartLine[]>(
    order.order_items.map((oi) => ({
      productId: oi.product_id,
      variantId: oi.variant_id,
      name: oi.product_name,
      attrLabel: attrsLabel(oi.variant_attributes),
      unitPrice: oi.unit_price,
      qty: oi.quantity,
    })),
  );
  const [selProductId, setSelProductId] = useState('');
  const [selVariantId, setSelVariantId] = useState('');
  const [selQty, setSelQty] = useState(1);
  const [savingItems, setSavingItems] = useState(false);

  const selectedProduct = products.find((p) => p.id === selProductId) ?? null;
  const activeVariants = (selectedProduct?.product_variants ?? []).filter((v) => v.is_active);

  const itemsTotal = useMemo(() => items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0), [items]);

  function addLine() {
    if (!selectedProduct) return;
    if (activeVariants.length > 0 && !selVariantId) return;
    const variant = activeVariants.find((v) => v.id === selVariantId) ?? null;
    const unitPrice = effectivePrice(selectedProduct.price, selectedProduct.discount_percent, variant) ?? 0;
    setItems((prev) => [
      ...prev,
      {
        productId: selectedProduct.id,
        variantId: variant?.id ?? null,
        name: selectedProduct.name,
        attrLabel: attrsLabel(variant?.attributes),
        unitPrice,
        qty: Math.max(1, Math.floor(selQty)),
      },
    ]);
    setSelProductId('');
    setSelVariantId('');
    setSelQty(1);
  }

  function removeLine(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function saveItemsAndContinue() {
    setSavingItems(true);
    startTransition(async () => {
      await setOrderItems(
        order.id,
        items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantity: i.qty })),
      );
      setSavingItems(false);
      setStep(3);
      router.refresh();
    });
  }

  // --- Paso 3: Pago ---
  const [paymentMethod, setPaymentMethod] = useState(order.payment_method ?? '');

  return (
    <>
      {/* Indicador de pasos */}
      <div className="section" style={{ paddingTop: 16, paddingBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setStep(n)}
                style={{
                  background: n === step ? 'var(--brand)' : 'var(--panel-2)',
                  color: n === step ? '#fff' : 'var(--muted)',
                  border: '1px solid var(--border)',
                  fontSize: 12.5,
                  padding: '7px 14px',
                }}
              >
                {n}. {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Paso 1: Cliente */}
      <div className="section" style={{ display: step === 1 ? 'block' : 'none' }}>
        <h3>1. Cliente</h3>
        <form action={setOrderCustomer.bind(null, order.id)}>
          <input type="hidden" name="contact_id" value={contact?.id ?? ''} />

          {!contact ? (
            <>
              <label>Buscar cliente *</label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nombre, teléfono o email"
                autoComplete="off"
              />
              {results.length > 0 && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginTop: 8, overflow: 'hidden' }}>
                  {results.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setContact(c);
                        setResults([]);
                        setQuery('');
                      }}
                      style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                    >
                      <strong>{contactLabel(c)}</strong>{' '}
                      <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>{c.phone || c.email || ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--panel-2)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '10px 14px',
                marginBottom: 12,
              }}
            >
              <div>
                <strong>{contactLabel(contact)}</strong>{' '}
                <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>{contact.phone || contact.email || ''}</span>
              </div>
              <button type="button" style={{ background: '#475569' }} onClick={() => setContact(null)}>
                Cambiar
              </button>
            </div>
          )}

          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400, marginTop: 16 }}>
            <input
              type="checkbox"
              name="requires_shipping"
              checked={requiresShipping}
              onChange={(e) => setRequiresShipping(e.target.checked)}
              style={{ width: 'auto', marginBottom: 0 }}
            />
            Requiere envío
          </label>

          <div style={{ display: requiresShipping ? 'block' : 'none', marginTop: 8 }}>
            <label>Dirección</label>
            <input name="shipping_address" defaultValue={order.shipping_address?.address ?? ''} placeholder="Calle y número" />
            <div className="row2">
              <div>
                <label>Ciudad</label>
                <input name="shipping_city" defaultValue={order.shipping_address?.city ?? ''} />
              </div>
              <div>
                <label>Provincia/Estado</label>
                <input name="shipping_state" defaultValue={order.shipping_address?.state ?? ''} />
              </div>
            </div>
            <div className="row2">
              <div>
                <label>Código postal</label>
                <input name="shipping_postal_code" defaultValue={order.shipping_address?.postal_code ?? ''} />
              </div>
              <div>
                <label>País</label>
                <input name="shipping_country" defaultValue={order.shipping_address?.country ?? ''} />
              </div>
            </div>
            <label>Referencia (opcional)</label>
            <input name="shipping_reference" defaultValue={order.shipping_address?.reference ?? ''} placeholder="Entre calles, piso, etc." />
          </div>

          <button type="submit" disabled={!contact} onClick={() => contact && setStep(2)} style={{ marginTop: 16 }}>
            Guardar y continuar →
          </button>
        </form>
      </div>

      {/* Paso 2: Productos */}
      <div className="section" style={{ display: step === 2 ? 'block' : 'none' }}>
        <h3>2. Productos</h3>
        <div className="row2">
          <div>
            <label>Producto</label>
            <select
              value={selProductId}
              onChange={(e) => {
                setSelProductId(e.target.value);
                setSelVariantId('');
              }}
            >
              <option value="">Seleccionar…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          {activeVariants.length > 0 && (
            <div>
              <label>Variante</label>
              <select value={selVariantId} onChange={(e) => setSelVariantId(e.target.value)}>
                <option value="">Seleccionar…</option>
                {activeVariants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {attrsLabel(v.attributes) || v.sku || v.id}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="row2">
          <div>
            <label>Cantidad</label>
            <input type="number" min={1} value={selQty} onChange={(e) => setSelQty(Number(e.target.value) || 1)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="button"
              onClick={addLine}
              disabled={!selProductId || (activeVariants.length > 0 && !selVariantId)}
            >
              + Agregar línea
            </button>
          </div>
        </div>

        <table style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cant.</th>
              <th>Precio unit.</th>
              <th>Subtotal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx}>
                <td>
                  {it.name}
                  {it.attrLabel ? ` (${it.attrLabel})` : ''}
                </td>
                <td>{it.qty}</td>
                <td>{money(it.unitPrice, order.currency)}</td>
                <td>{money(it.unitPrice * it.qty, order.currency)}</td>
                <td>
                  <button type="button" className="danger" onClick={() => removeLine(idx)}>
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <p className="empty">Aún no agregaste productos.</p>}

        <p style={{ marginTop: 12, fontSize: 16 }}>
          <strong>Total: {money(itemsTotal, order.currency)}</strong>
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            style={{ background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
            onClick={() => setStep(1)}
          >
            ← Atrás
          </button>
          <button type="button" disabled={items.length === 0 || savingItems} onClick={saveItemsAndContinue}>
            {savingItems ? 'Guardando…' : 'Guardar y continuar →'}
          </button>
        </div>
      </div>

      {/* Paso 3: Pago */}
      <div className="section" style={{ display: step === 3 ? 'block' : 'none' }}>
        <h3>3. Pago</h3>
        <form action={setOrderPayment.bind(null, order.id)}>
          <label>Método de pago</label>
          <select name="payment_method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="">Seleccionar…</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="otro">Otro</option>
          </select>
          <p style={{ marginTop: 12 }}>
            Total del pedido: <strong>{money(itemsTotal, order.currency)}</strong>
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              style={{ background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
              onClick={() => setStep(2)}
            >
              ← Atrás
            </button>
            <button type="submit" onClick={() => setStep(4)}>
              Guardar y continuar →
            </button>
          </div>
        </form>
      </div>

      {/* Paso 4: Revisar y confirmar */}
      <div className="section" style={{ display: step === 4 ? 'block' : 'none' }}>
        <h3>4. Revisar y confirmar</h3>
        <p>
          <strong>Cliente:</strong> {contactLabel(contact)}
        </p>
        {requiresShipping && (
          <p>
            <strong>Envío:</strong> {formatShippingAddress(order.shipping_address)}
          </p>
        )}
        <p style={{ marginTop: 12 }}>
          <strong>Productos:</strong>
        </p>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cant.</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx}>
                <td>
                  {it.name}
                  {it.attrLabel ? ` (${it.attrLabel})` : ''}
                </td>
                <td>{it.qty}</td>
                <td>{money(it.unitPrice * it.qty, order.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop: 12 }}>
          <strong>Pago:</strong> {PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod ?? '—'}
        </p>
        <p style={{ marginTop: 8, fontSize: 18 }}>
          <strong>Total: {money(itemsTotal, order.currency)}</strong>
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 16 }}>
          <button
            type="button"
            style={{ background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
            onClick={() => setStep(3)}
          >
            ← Atrás
          </button>
          <form action={confirmOrder.bind(null, order.id)} onSubmit={() => setStatus('confirmed')}>
            <button type="submit" disabled={status !== 'draft' || !contact || items.length === 0}>
              Confirmar pedido
            </button>
          </form>
          {status !== 'draft' && (
            <span className="badge" style={{ background: '#22c55e' }}>
              Este pedido ya fue confirmado
            </span>
          )}
        </div>
      </div>

      {/* Estado y pago: cambios post-creación, fuera del wizard de pasos. */}
      <div className="section">
        <h3>Estado del pedido</h3>
        <div className="row2">
          <div>
            <label>Estado</label>
            <select
              defaultValue={order.status}
              onChange={(e) => {
                const value = e.target.value;
                startTransition(() => updateOrderStatus(order.id, value));
                setStatus(value as Order['status']);
              }}
            >
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Pago</label>
            <select
              defaultValue={order.payment_status}
              onChange={(e) => startTransition(() => updateOrderPaymentStatus(order.id, e.target.value))}
            >
              {Object.entries(PAYMENT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {status !== 'cancelled' && (
        <div className="section">
          <h3>Cancelar</h3>
          <p style={{ color: 'var(--muted)', marginBottom: 12 }}>Esta acción no se puede deshacer.</p>
          <form
            action={cancelOrder.bind(null, order.id)}
            onSubmit={(e) => {
              if (!confirm(`¿Cancelar el pedido #${order.order_number}?`)) e.preventDefault();
            }}
          >
            <button className="danger" type="submit">
              Cancelar pedido
            </button>
          </form>
        </div>
      )}
    </>
  );
}
