'use server';

import { getAdmin } from '@/lib/supabase-admin';
import { requireAccess } from '@/lib/access';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

/**
 * Convierte texto libre tipo "Talla: M, Color: Rojo" en un objeto jsonb
 * {"talla":"M","color":"Rojo"} para product_variants.attributes. Sin editor
 * de atributos dinámico (agregar/quitar filas con JS): un solo campo de texto
 * alcanza para lo que pide el diseño y evita un client component nuevo.
 */
function parseAttributes(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of text.split(',')) {
    const [k, ...rest] = part.split(':');
    const key = k?.trim();
    const value = rest.join(':').trim();
    if (key && value) out[key.toLowerCase()] = value;
  }
  return out;
}

/** Lee un numero opcional de un FormData; string vacío = null (no "a consultar" involuntario). */
function optionalNumber(formData: FormData, field: string): number | null {
  const raw = String(formData.get(field) ?? '').trim();
  return raw ? Number(raw) : null;
}

/** Crea un producto desde el formulario del panel. */
export async function createProduct(formData: FormData) {
  await requireAccess('configuracion.productos');
  const db = getAdmin();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;

  await db.from('products').insert({
    name,
    description: String(formData.get('description') ?? '').trim() || null,
    kind: String(formData.get('kind') ?? 'product'),
    price: optionalNumber(formData, 'price'),
    currency: String(formData.get('currency') ?? 'USD').trim() || 'USD',
    sales_brief: String(formData.get('sales_brief') ?? '').trim() || null,
    discount_percent: optionalNumber(formData, 'discount_percent'),
  });
  revalidatePath('/products');
}

/** Activa/desactiva un producto. */
export async function toggleProduct(id: string, active: boolean) {
  await requireAccess('configuracion.productos');
  const db = getAdmin();
  await db.from('products').update({ is_active: active }).eq('id', id);
  revalidatePath('/products');
}

/** Actualiza los datos de un producto existente desde el formulario de edición. */
export async function updateProduct(id: string, formData: FormData) {
  await requireAccess('configuracion.productos');
  const db = getAdmin();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;

  await db
    .from('products')
    .update({
      name,
      description: String(formData.get('description') ?? '').trim() || null,
      kind: String(formData.get('kind') ?? 'product'),
      price: optionalNumber(formData, 'price'),
      currency: String(formData.get('currency') ?? 'USD').trim() || 'USD',
      sales_brief: String(formData.get('sales_brief') ?? '').trim() || null,
      discount_percent: optionalNumber(formData, 'discount_percent'),
    })
    .eq('id', id);
  revalidatePath('/products');
  redirect('/products');
}

/** Elimina un producto. */
export async function deleteProduct(id: string) {
  await requireAccess('configuracion.productos');
  const db = getAdmin();
  await db.from('products').delete().eq('id', id);
  revalidatePath('/products');
  redirect('/products');
}

// =============================================================================
// Variantes (talla/color/material/etc.) — CRUD dentro del mismo permiso que
// products, mismo patrón requireAccess + revalidatePath('/products/'+productId).
// =============================================================================

/** Crea una variante para un producto desde el mini-form de su página de edición. */
export async function createVariant(productId: string, formData: FormData) {
  await requireAccess('configuracion.productos');
  const db = getAdmin();
  const attributesText = String(formData.get('attributes') ?? '').trim();

  await db.from('product_variants').insert({
    product_id: productId,
    sku: String(formData.get('sku') ?? '').trim() || null,
    attributes: parseAttributes(attributesText),
    price: optionalNumber(formData, 'price'),
    discount_percent: optionalNumber(formData, 'discount_percent'),
    stock: optionalNumber(formData, 'stock'),
  });
  revalidatePath(`/products/${productId}`);
}

/** Actualiza una variante existente. */
export async function updateVariant(productId: string, variantId: string, formData: FormData) {
  await requireAccess('configuracion.productos');
  const db = getAdmin();
  const attributesText = String(formData.get('attributes') ?? '').trim();

  await db
    .from('product_variants')
    .update({
      sku: String(formData.get('sku') ?? '').trim() || null,
      attributes: parseAttributes(attributesText),
      price: optionalNumber(formData, 'price'),
      discount_percent: optionalNumber(formData, 'discount_percent'),
      stock: optionalNumber(formData, 'stock'),
    })
    .eq('id', variantId);
  revalidatePath(`/products/${productId}`);
}

/** Activa/desactiva una variante (deja de ofrecerse sin borrar su historial). */
export async function toggleVariant(productId: string, variantId: string, active: boolean) {
  await requireAccess('configuracion.productos');
  const db = getAdmin();
  await db.from('product_variants').update({ is_active: active }).eq('id', variantId);
  revalidatePath(`/products/${productId}`);
}

/** Elimina una variante. */
export async function deleteVariant(productId: string, variantId: string) {
  await requireAccess('configuracion.productos');
  const db = getAdmin();
  await db.from('product_variants').delete().eq('id', variantId);
  revalidatePath(`/products/${productId}`);
}
