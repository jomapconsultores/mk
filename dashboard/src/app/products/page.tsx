import { getAdmin } from '@/lib/supabase-admin';
import { requireAccess } from '@/lib/access';
import { money, effectivePrice } from '@/lib/format';
import { createProduct, toggleProduct } from './actions';

export const dynamic = 'force-dynamic';

/** Línea de precio para la tabla: rango si hay variantes, precio (con descuento) si no. */
function priceLabel(p: {
  price: number | null;
  currency: string;
  discount_percent: number | null;
  product_variants?: { price: number | null; discount_percent: number | null; is_active: boolean }[];
}): string {
  const variants = (p.product_variants ?? []).filter((v) => v.is_active);
  if (variants.length === 0) {
    return money(effectivePrice(p.price, p.discount_percent), p.currency);
  }
  const prices = variants
    .map((v) => effectivePrice(v.price ?? p.price, v.discount_percent ?? p.discount_percent))
    .filter((x): x is number => x != null);
  if (prices.length === 0) return '—';
  const min = Math.min(...prices), max = Math.max(...prices);
  return min === max ? money(min, p.currency) : `desde ${money(min, p.currency)}`;
}

export default async function ProductsPage() {
  await requireAccess('configuracion.productos');
  const db = getAdmin();
  const { data: products } = await db
    .from('products')
    .select(
      'id, name, description, kind, price, currency, is_active, sales_brief, discount_percent, product_variants(price, discount_percent, is_active)',
    )
    .order('created_at', { ascending: false });

  return (
    <>
      <h2>Productos</h2>
      <p className="subtitle">Lo que la IA usa para responder y vender. El "argumento de venta" la ayuda a convencer.</p>

      <div className="section">
        <h3>Agregar producto / servicio</h3>
        <form action={createProduct}>
          <div className="row2">
            <div>
              <label>Nombre *</label>
              <input name="name" required placeholder="Ej: Plan Premium" />
            </div>
            <div>
              <label>Tipo</label>
              <select name="kind">
                <option value="product">Producto</option>
                <option value="service">Servicio</option>
              </select>
            </div>
          </div>
          <div className="row2">
            <div>
              <label>Precio</label>
              <input name="price" type="number" step="0.01" placeholder="29.90" />
            </div>
            <div>
              <label>Moneda</label>
              <input name="currency" defaultValue="USD" />
            </div>
          </div>
          <label>Descuento % (opcional; se aplica si el producto no tiene variantes o la variante no define el suyo)</label>
          <input name="discount_percent" type="number" step="0.01" min="0" max="100" placeholder="10" />
          <label>Descripción</label>
          <input name="description" placeholder="Qué es y para qué sirve" />
          <label>Argumento de venta (beneficio clave + objeción común)</label>
          <textarea name="sales_brief" rows={3} placeholder='Ej: "Ahorra 5h/semana. Si dicen que es caro, ofrecer prueba de 7 días."' />
          <button type="submit">Guardar producto</button>
        </form>
      </div>

      <div className="section">
        <h3>Catálogo</h3>
        <table>
          <thead><tr><th>Nombre</th><th>Tipo</th><th>Precio</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            {(products ?? []).map((p) => {
              const variantCount = (p.product_variants ?? []).length;
              return (
              <tr key={p.id}>
                <td><strong>{p.name}</strong><br /><span style={{ color: 'var(--muted)', fontSize: 12 }}>{p.description}</span></td>
                <td>{p.kind === 'service' ? 'Servicio' : 'Producto'}</td>
                <td>
                  {priceLabel(p)}
                  {!!p.discount_percent && <><br /><span className="badge" style={{ background: '#f59e0b' }}>-{p.discount_percent}%</span></>}
                  {variantCount > 0 && <><br /><span style={{ color: 'var(--muted)', fontSize: 12 }}>{variantCount} variante{variantCount === 1 ? '' : 's'}</span></>}
                </td>
                <td>{p.is_active ? '✅ Activo' : '⏸️ Inactivo'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <a href={`/products/${p.id}`} className="badge" style={{ background: '#6366f1' }}>Editar</a>
                    <form action={toggleProduct.bind(null, p.id, !p.is_active)}>
                      <button type="submit" style={{ background: p.is_active ? '#475569' : '#22c55e' }}>
                        {p.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        {(!products || products.length === 0) && <p className="empty">Aún no hay productos. Agrega el primero arriba ☝️</p>}
      </div>
    </>
  );
}
