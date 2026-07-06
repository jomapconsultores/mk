import { getAdmin } from '@/lib/supabase-admin';
import { requireAccess } from '@/lib/access';
import { updateProduct, deleteProduct } from '../actions';

export const dynamic = 'force-dynamic';

export default async function EditProduct({ params }: { params: { id: string } }) {
  await requireAccess('configuracion.productos');
  const db = getAdmin();
  const { data: p } = await db.from('products').select('*').eq('id', params.id).maybeSingle();
  if (!p) return <p className="empty">Producto no encontrado.</p>;

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
          <label>Descripción</label>
          <input name="description" defaultValue={p.description ?? ''} />
          <label>Argumento de venta (beneficio clave + objeción común)</label>
          <textarea name="sales_brief" rows={4} defaultValue={p.sales_brief ?? ''} />
          <button type="submit">Guardar cambios</button>
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
