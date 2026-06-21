import { db } from '../db.js';
import { qualifyProspect } from './qualifier.js';

interface RawProspect {
  full_name?: string;
  company?: string;
  email?: string;
  phone?: string;
  website?: string;
  industry?: string;
  location?: string;
  [key: string]: string | undefined;
}

/** Parsea texto CSV (con cabecera) en objetos crudos. */
export function parseCsv(text: string): RawProspect[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/[\s"']+/g, '_'));

  // Mapa de sinónimos → campo estándar
  const FIELD_MAP: Record<string, keyof RawProspect> = {
    nombre: 'full_name', name: 'full_name', cliente: 'full_name', contacto: 'full_name',
    empresa: 'company', compania: 'company', negocio: 'company', organization: 'company',
    email: 'email', correo: 'email', mail: 'email',
    phone: 'phone', telefono: 'phone', celular: 'phone', movil: 'phone', whatsapp: 'phone',
    web: 'website', website: 'website', sitio: 'website', url: 'website',
    industria: 'industry', sector: 'industry', rubro: 'industry', industry: 'industry',
    ciudad: 'location', ubicacion: 'location', location: 'location', pais: 'location',
  };

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const raw: RawProspect = {};

    headers.forEach((header, i) => {
      const value = values[i]?.trim().replace(/^["']|["']$/g, '') ?? '';
      if (!value) return;
      const field = FIELD_MAP[header];
      if (field) raw[field] = value;
      else raw[header] = value;  // guardar campo desconocido en raw_data
    });

    return raw;
  }).filter((r) => r.full_name || r.email || r.phone || r.company);
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(current); current = ''; continue; }
    current += ch;
  }
  result.push(current);
  return result;
}

/**
 * Importa prospectos desde texto CSV.
 * Deduplica por email/teléfono. Califica en background con IA.
 * Devuelve { imported, duplicates }.
 */
export async function importProspectsFromCsv(opts: {
  csvText: string;
  sourceName: string;
  qualifyWithAi?: boolean;   // si true, califica todos con IA (tarda más)
}): Promise<{ imported: number; duplicates: number; sourceId: string }> {
  const rows = parseCsv(opts.csvText);
  if (rows.length === 0) throw new Error('No se encontraron prospectos en el CSV');

  // Crear fuente
  const { data: source } = await db
    .from('prospect_sources')
    .insert({ name: opts.sourceName, type: 'csv_import' })
    .select('id')
    .single();
  const sourceId = source!.id;

  let imported = 0;
  let duplicates = 0;

  for (const row of rows) {
    // Deduplicar por email o teléfono
    if (row.email || row.phone) {
      const counts: number[] = [];
      if (row.email) {
        const r = await db.from('prospects').select('id', { count: 'exact', head: true }).eq('email', row.email);
        counts.push(r.count ?? 0);
      }
      if (row.phone) {
        const r = await db.from('prospects').select('id', { count: 'exact', head: true }).eq('phone', row.phone);
        counts.push(r.count ?? 0);
      }
      if (counts.some((c) => c > 0)) { duplicates++; continue; }
    }

    const { raw_data, ...knownFields } = row;
    const { full_name, company, email, phone, website, industry, location, ...extra } = knownFields;

    const { error } = await db.from('prospects').insert({
      source_id:  sourceId,
      full_name:  full_name   ?? null,
      company:    company     ?? null,
      email:      email       ?? null,
      phone:      phone       ?? null,
      website:    website     ?? null,
      industry:   industry    ?? null,
      location:   location    ?? null,
      status:     'new',
      raw_data:   Object.keys(extra).length ? extra : {},
    });

    if (!error) imported++;
    else console.error('[importer] error insertando prospecto:', error.message);
  }

  // Si se pide, calificar con IA en segundo plano (sin bloquear la respuesta)
  if (opts.qualifyWithAi) {
    qualifyAllNew(sourceId).catch((e) => console.error('[importer] error calificando:', e));
  }

  return { imported, duplicates, sourceId };
}

/** Califica prospectos 'new' con la IA. Retorna cuántos procesó. */
export async function qualifyAllNew(sourceId?: string, batchSize = 20): Promise<{ processed: number; qualified: number; errors: number }> {
  let q = db.from('prospects').select('*').eq('status', 'new').limit(batchSize);
  if (sourceId) q = q.eq('source_id', sourceId);
  const { data: prospects } = await q;

  let qualified = 0;
  let errors = 0;

  for (const p of prospects ?? []) {
    try {
      await db.from('prospects').update({ status: 'qualifying' }).eq('id', p.id);

      const result = await qualifyProspect({
        full_name:  p.full_name,
        company:    p.company,
        industry:   p.industry,
        location:   p.location,
        website:    p.website,
        raw_data:   p.raw_data,
      });

      await db.from('prospects').update({
        status:                 'qualified',
        fit_score:              result.fit_score,
        industry:               result.industry,
        main_pain:              result.main_pain,
        outreach_angle:         result.outreach_angle,
        recommended_product_id: result.recommended_product_id,
        ai_profile_summary:     result.ai_profile_summary,
        disc_estimate:          result.disc_estimate   ?? null,
        awareness_level:        result.awareness_level ?? null,
        emotional_hook:         result.emotional_hook  ?? null,
        best_channel:           result.best_channel    ?? null,
        icebreaker:             result.icebreaker      ?? null,
        qualified_at:           new Date().toISOString(),
      }).eq('id', p.id);

      qualified++;
    } catch (err) {
      console.error(`[importer] error calificando ${p.id}:`, err);
      await db.from('prospects').update({ status: 'new' }).eq('id', p.id);
      errors++;
    }
  }

  return { processed: (prospects ?? []).length, qualified, errors };
}
