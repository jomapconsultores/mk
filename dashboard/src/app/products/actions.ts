'use server';

import { getAdmin } from '@/lib/supabase-admin';
import { revalidatePath } from 'next/cache';

/** Crea un producto desde el formulario del panel. */
export async function createProduct(formData: FormData) {
  const db = getAdmin();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;

  const priceRaw = String(formData.get('price') ?? '').trim();
  await db.from('products').insert({
    name,
    description: String(formData.get('description') ?? '').trim() || null,
    kind: String(formData.get('kind') ?? 'product'),
    price: priceRaw ? Number(priceRaw) : null,
    currency: String(formData.get('currency') ?? 'USD').trim() || 'USD',
    sales_brief: String(formData.get('sales_brief') ?? '').trim() || null,
  });
  revalidatePath('/products');
}

/** Activa/desactiva un producto. */
export async function toggleProduct(id: string, active: boolean) {
  const db = getAdmin();
  await db.from('products').update({ is_active: active }).eq('id', id);
  revalidatePath('/products');
}
