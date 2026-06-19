import { getAdmin } from '@/lib/supabase-admin';
import { money } from '@/lib/format';
import { createProduct, toggleProduct } from './actions';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const db = getAdmin();
  const { data: products } = await db
    .from('products')
    .select('id, name, description, kind, price, currency, is_active, sales_brief')
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
            {(products ?? []).map((p) => (
              <tr key={p.id}>
                <td><strong>{p.name}</strong><br /><span style={{ color: 'var(--muted)', fontSize: 12 }}>{p.description}</span></td>
                <td>{p.kind === 'service' ? 'Servicio' : 'Producto'}</td>
                <td>{money(p.price, p.currency)}</td>
                <td>{p.is_active ? '✅ Activo' : '⏸️ Inactivo'}</td>
                <td>
                  <form action={toggleProduct.bind(null, p.id, !p.is_active)}>
                    <button type="submit" style={{ background: p.is_active ? '#475569' : '#22c55e' }}>
                      {p.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!products || products.length === 0) && <p className="empty">Aún no hay productos. Agrega el primero arriba ☝️</p>}
      </div>
    </>
  );
}
