'use server';

import { getAdmin } from '@/lib/supabase-admin';
import { redirect } from 'next/navigation';

/** Normaliza texto: minúsculas y sin acentos (para mapear cabeceras). */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Parser CSV mínimo que respeta comillas y el delimitador dado. */
function parseCSV(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === delim) { cur.push(field); field = ''; }
      else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
      else if (c !== '\r') field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

export async function importContacts(formData: FormData) {
  if (!formData.get('consent')) redirect('/prospeccion?tab=csv&err=consent');

  const file = formData.get('file') as File | null;
  const pasted = String(formData.get('pasted') ?? '');
  let text = '';
  if (file && typeof file.text === 'function' && file.size > 0) text = await file.text();
  else text = pasted;
  text = text.trim();
  if (!text) redirect('/prospeccion?tab=csv&err=empty');

  const firstLine = text.split('\n')[0];
  const delim = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
  const rows = parseCSV(text, delim);
  if (rows.length < 2) redirect('/prospeccion?tab=csv&err=empty');

  const header = rows[0].map(norm);
  const idx = (keys: string[]) => header.findIndex((h) => keys.some((k) => h.includes(k)));
  const iName = idx(['nombre', 'name', 'cliente', 'completo']);
  const iEmail = idx(['email', 'correo', 'mail']);
  const iMobile = idx(['movil', 'celular', 'cel', 'whatsapp']);
  const iGeneric = idx(['telefono', 'phone', 'contacto']);
  const iHome = idx(['casa', 'domicilio', 'hogar', 'home']);
  const iWork = idx(['trabajo', 'oficina', 'work', 'laboral']);
  const iMobileCol = iMobile >= 0 ? iMobile : iGeneric;

  const get = (row: string[], i: number) => (i >= 0 && i < row.length ? String(row[i]).trim() : '');

  const items: { full_name: string; email: string; phone: string; phone_home: string; phone_work: string }[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const full_name = get(row, iName);
    const email = get(row, iEmail).toLowerCase();
    const phone = get(row, iMobileCol);
    const phone_home = get(row, iHome);
    const phone_work = get(row, iWork);
    if (!full_name && !email && !phone) continue;
    items.push({ full_name, email, phone, phone_home, phone_work });
  }
  if (!items.length) redirect('/prospeccion?tab=csv&ok=0&dup=0');

  const db = getAdmin();
  const { data: existing } = await db.from('contacts').select('email, phone');
  const seenEmail = new Set((existing ?? []).map((e) => (e.email ?? '').toLowerCase()).filter(Boolean));
  const seenPhone = new Set((existing ?? []).map((e) => e.phone ?? '').filter(Boolean));

  const toInsert: Record<string, unknown>[] = [];
  let dup = 0;
  for (const it of items) {
    if ((it.email && seenEmail.has(it.email)) || (it.phone && seenPhone.has(it.phone))) { dup++; continue; }
    if (it.email) seenEmail.add(it.email);
    if (it.phone) seenPhone.add(it.phone);
    toInsert.push({
      full_name: it.full_name || null,
      display_name: it.full_name || null,
      email: it.email || null,
      phone: it.phone || null,
      phone_home: it.phone_home || null,
      phone_work: it.phone_work || null,
      stage: 'new',
      metadata: { source: 'import', import_consent: true },
    });
  }

  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 500) {
    const batch = toInsert.slice(i, i + 500);
    const { error } = await db.from('contacts').insert(batch);
    if (!error) inserted += batch.length;
  }

  redirect(`/prospeccion?tab=csv&ok=${inserted}&dup=${dup}`);
}
