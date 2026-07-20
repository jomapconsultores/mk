// Etiquetas y colores legibles para las etapas y niveles.

export const STAGE_LABELS: Record<string, string> = {
  new: 'Nuevo',
  engaged: 'Interesado',
  qualified: 'Calificado',
  negotiating: 'Negociando',
  customer: 'Cliente',
  lost: 'Perdido',
};

export const STAGE_COLORS: Record<string, string> = {
  new: '#64748b',
  engaged: '#0ea5e9',
  qualified: '#6366f1',
  negotiating: '#f59e0b',
  customer: '#22c55e',
  lost: '#ef4444',
};

export const INTEREST_LABELS: Record<string, string> = {
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
};

export const STAGE_ORDER = ['new', 'engaged', 'qualified', 'negotiating', 'customer', 'lost'];

export function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function money(value: number | null, currency = 'USD'): string {
  if (value == null) return '—';
  return `${value.toLocaleString('es', { minimumFractionDigits: 2 })} ${currency}`;
}

/** Precio con descuento aplicado (o el mismo precio si no hay descuento). */
export function effectivePrice(price: number | null, discountPercent: number | null): number | null {
  if (price == null) return null;
  return discountPercent ? Number((price * (1 - discountPercent / 100)).toFixed(2)) : price;
}

/**
 * Solo dígitos de un teléfono, para armar enlaces wa.me. Devuelve null si no
 * queda un número plausible: mejor texto plano que un enlace roto que abre
 * WhatsApp en un chat inexistente.
 */
export function waDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length < 8 || digits.length > 15) return null;
  // Un número ecuatoriano en formato nacional (09XXXXXXXX -> 9XXXXXXXX) necesita
  // el prefijo país para wa.me; los que ya vienen en internacional se dejan.
  if (digits.length === 9 && digits.startsWith('9')) return `593${digits}`;
  return digits;
}

/** URL de chat de WhatsApp, o null si el teléfono no sirve. */
export function waLink(phone: string | null | undefined, text?: string): string | null {
  const d = waDigits(phone);
  if (!d) return null;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** Sanea un término de búsqueda para usarlo dentro de un .or(...ilike...) de PostgREST. */
export function searchTerm(raw: string | undefined | null): string {
  return (raw ?? '').trim().replace(/[,%()]/g, ' ').trim().slice(0, 60);
}

/** "Talla: M, Color: Rojo" a partir de {"talla":"M","color":"Rojo"} — inverso de parseAttributes. */
export function formatAttributes(attributes: Record<string, string> | null | undefined): string {
  if (!attributes) return '';
  return Object.entries(attributes)
    .map(([k, v]) => `${k.charAt(0).toUpperCase()}${k.slice(1)}: ${v}`)
    .join(', ');
}
