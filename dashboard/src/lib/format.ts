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
