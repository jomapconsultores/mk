import { getAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function csvCell(v: string | null): string {
  const s = (v ?? '').replace(/"/g, '""');
  return /[",\n;]/.test(s) ? `"${s}"` : s;
}

/**
 * Exporta contactos en CSV para subir como "Audiencia personalizada" en Meta/Google Ads
 * (la plataforma los usa para crear audiencias "lookalike"). SOLO incluye contactos que
 * NO se han dado de baja (respeta el consentimiento).
 *   /api/export            -> todos los contactos consentidos
 *   /api/export?type=customers -> solo clientes ganados (mejor semilla para lookalike)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get('type');

  const db = getAdmin();
  let q = db
    .from('contacts')
    .select('full_name, email, phone, country, stage, marketing_opted_out')
    .eq('marketing_opted_out', false)
    .limit(50000);
  if (type === 'customers') q = q.eq('stage', 'customer');

  const { data } = await q;

  // Formato compatible con Meta Custom Audiences: email, phone, fn, ln, country
  const lines = ['email,phone,fn,ln,country'];
  for (const c of data ?? []) {
    const parts = (c.full_name ?? '').trim().split(/\s+/);
    const fn = parts[0] ?? '';
    const ln = parts.slice(1).join(' ');
    lines.push([c.email, c.phone, fn, ln, c.country].map(csvCell).join(','));
  }
  const csv = lines.join('\n');

  const filename = type === 'customers' ? 'audiencia-clientes.csv' : 'audiencia-todos.csv';
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
