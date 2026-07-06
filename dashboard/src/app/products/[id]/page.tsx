import { getAdmin } from '@/lib/supabase-admin';
import { requireAccess } from '@/lib/access';
import { money, effectivePrice, formatAttributes } from '@/lib/format';
import {
  updateProduct,
  deleteProduct,
  createVariant,
  updateVariant,
  toggleVariant,
  deleteVariant,
} from '../actions';

export const dynamic = 'force-dynamic';

export default async function EditProduct({ params }: { params: { id: string } }) {
  await requireAccess('configuracion.productos');
  const db = getAdmin();
  const { data: p } = await db.from('products').select('*').eq('id', params.id).maybeSingle();
  if (!p) return <p className="empty">Producto no encontrado.</p>;

  const { data: variants } = await db
    .from('product_variants')
    .select('id, sku, attributes, price, discount_percent, stock, is_active')
    .eq('product_id', p.id)
    .order('created_at', { ascending: true });

  return (
    <>
      <p style={{ marginBottom: 12 }}><a href="/products">← Volver a productos</a></p>
      <h2>Editar producto</h2>
      <p className="subtitle">Ajusta precio, descripción y argumento de venta. La IA usará esto al vender.</p>

      <div className="section">
        <form action={updateProduct.bind(null, p.id)}>
          <div className="row2">
            <div>
              <label>Nombre *</label>
              <input name="name" required defaultValue={p.name} />
            </div>
            <div>
              <label>Tipo</label>
              <select name="kind" defaultValue={p.kind}>
                <option value="product">Producto</option>
                <option value="service">Servicio</option>
              </select>
            </div>
          </div>
          <div className="row2">
            <div>
              <label>Precio (déjalo vacío para "a consultar")</label>
              <input name="price" type="number" step="0.01" defaultValue={p.price ?? ''} />
            </div>
            <div>
              <label>Moneda</label>
              <input name="currency" defaultValue={p.currency ?? 'USD'} />
            </div>
          </div>
          <label>Descuento % (opcional; se aplica si no hay variantes o la variante no define el suyo)</label>
          <input name="discount_percent" type="number" step="0.01" min="0" max="100" defaultValue={p.discount_percent ?? ''} />
          <label>Descripción</label>
          <input name="description" defaultValue={p.description ?? ''} />
          <label>Argumento de venta (beneficio clave + objeción común)</label>
          <textarea name="sales_brief" rows={4} defaultValue={p.sales_brief ?? ''} />
          <button type="submit">Guardar cambios</button>
        </form>
      </div>

      <div className="section">
        <h3>Variantes</h3>
        <p style={{ color: 'var(--muted)', marginBottom: 12 }}>
          Talla, color, material, etc. Si no agregas ninguna, el producto se vende tal cual (precio y descuento de arriba).
        </p>

        {(variants ?? []).length > 0 && (
          <table style={{ marginBottom: 20 }}>
            <thead>
              <tr>
                <th>SKU</th><th>Atributos</th><th>Precio</th><th>Descuento</th><th>Stock</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {(variants ?? []).map((v) => (
                <tr key={v.id}>
                  <td>
                    <form action={updateVariant.bind(null, p.id, v.id)} id={`variant-form-${v.id}`}>
                      <input name="sku" defaultValue={v.sku ?? ''} placeholder="SKU" style={{ marginBottom: 0 }} />
                    </form>
                  </td>
                  <td>
                    <input form={`variant-form-${v.id}`} name="attributes" defaultValue={formatAttributes(v.attributes)} placeholder="Talla: M, Color: Rojo" style={{ marginBottom: 0 }} />
                  </td>
                  <td>
                    <input form={`variant-form-${v.id}`} name="price" type="number" step="0.01" defaultValue={v.price ?? ''} placeholder={String(p.price ?? '')} style={{ marginBottom: 0, width: 100 }} />
                    <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 4 }}>
                      Efectivo: {money(effectivePrice(v.price ?? p.price, v.discount_percent ?? p.discount_percent), p.currency)}
                    </div>
                  </td>
                  <td>
                    <input form={`variant-form-${v.id}`} name="discount_percent" type="number" step="0.01" min="0" max="100" defaultValue={v.discount_percent ?? ''} placeholder={String(p.discount_percent ?? '')} style={{ marginBottom: 0, width: 80 }} />
                  </td>
                  <td>
                    <input form={`variant-form-${v.id}`} name="stock" type="number" step="1" defaultValue={v.stock ?? ''} placeholder="∞" style={{ marginBottom: 0, width: 70 }} />
                  </td>
                  <td>{v.is_active ? '✅' : '⏸️'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button type="submit" form={`variant-form-${v.id}`} style={{ padding: '6px 10px', fontSize: 12 }}>Guardar</button>
                      <form action={toggleVariant.bind(null, p.id, v.id, !v.is_active)}>
                        <button type="submit" style={{ background: v.is_active ? '#475569' : '#22c55e', padding: '6px 10px', fontSize: 12 }}>
                          {v.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                      </form>
                      <form action={deleteVariant.bind(null, p.id, v.id)}>
                        <button className="danger" type="submit" style={{ padding: '6px 10px', fontSize: 12 }}>Eliminar</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h3 style={{ fontSize: 14 }}>Agregar variante</h3>
        <form action={createVariant.bind(null, p.id)}>
          <div className="row2">
            <div>
              <label>SKU (opcional)</label>
              <input name="sku" placeholder="Ej: CAM-M-ROJO" />
            </div>
            <div>
              <label>Atributos</label>
              <input name="attributes" placeholder="Talla: M, Color: Rojo" />
            </div>
          </div>
          <div className="row2">
            <div>
              <label>Precio override (vacío = usa el precio del producto)</label>
              <input name="price" type="number" step="0.01" placeholder={String(p.price ?? '')} />
            </div>
            <div>
              <label>Descuento % override (vacío = usa el del producto)</label>
              <input name="discount_percent" type="number" step="0.01" min="0" max="100" placeholder={String(p.discount_percent ?? '')} />
            </div>
          </div>
          <label>Stock (vacío = sin control de stock)</label>
          <input name="stock" type="number" step="1" placeholder="∞" />
          <button type="submit">Agregar variante</button>
        </form>
      </div>

      <div className="section">
        <h3>Eliminar</h3>
        <p style={{ color: 'var(--muted)', marginBottom: 12 }}>Esta acción no se puede deshacer.</p>
        <form action={deleteProduct.bind(null, p.id)}>
          <button className="danger" type="submit">Eliminar producto</button>
        </form>
      </div>
    </>
  );
}
