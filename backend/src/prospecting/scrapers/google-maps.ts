import { db } from '../../db.js';
import { config } from '../../config.js';
import { qualifyAllNew } from '../importer.js';

export interface PlaceResult {
  name: string;
  phone?: string;
  website?: string;
  address?: string;
  types?: string[];
}

/**
 * Busca negocios en Google Places y los guarda como prospectos.
 * Usa la API de Google Places v1 (New Places API).
 * Requiere GOOGLE_PLACES_API_KEY en .env
 */
export async function scrapeGoogleMaps(opts: {
  query: string;       // p.ej. "restaurantes en Quito Ecuador"
  maxResults?: number;
  qualifyWithAi?: boolean;
  personaTipo?: 'juridica' | 'natural'; // jurídica = negocio (company); natural = profesional independiente (full_name)
  extraData?: Record<string, unknown>; // metadata adicional que se guarda en raw_data (ej. rama, producto_objetivo)
}): Promise<{ found: number; saved: number; sourceId: string }> {
  const apiKey = config.google.placesApiKey;
  if (!apiKey) throw new Error('Falta GOOGLE_PLACES_API_KEY en .env');

  const maxResults = opts.maxResults ?? 20;

  // Crear fuente
  const { data: source, error: sourceError } = await db
    .from('prospect_sources')
    .insert({
      name:   `Google Maps: ${opts.query}`,
      type:   'google_maps',
      config: { query: opts.query },
    })
    .select('id')
    .single();
  if (!source) throw new Error(`Error creando fuente en BD: ${sourceError?.message ?? 'respuesta vacía — tabla prospect_sources no existe o RLS bloqueó el insert'}`);
  const sourceId = source.id;

  const places = await searchPlaces(opts.query, maxResults, apiKey);
  const esNatural = opts.personaTipo === 'natural';
  let saved = 0;

  for (const place of places) {
    // Dedup por teléfono
    if (place.phone) {
      const { count } = await db.from('prospects').select('id', { count: 'exact', head: true }).eq('phone', place.phone);
      if ((count ?? 0) > 0) continue;
    } else {
      // Sin teléfono (frecuente en personas naturales): dedup por nombre + ubicación
      const col = esNatural ? 'full_name' : 'company';
      let q = db.from('prospects').select('id', { count: 'exact', head: true }).eq(col, place.name);
      if (place.address) q = q.eq('location', place.address);
      const { count } = await q;
      if ((count ?? 0) > 0) continue;
    }

    // Persona natural → el listado de Maps es el nombre del profesional (full_name).
    // Persona jurídica → es el nombre del negocio (company).
    const { error } = await db.from('prospects').insert({
      source_id:  sourceId,
      full_name:  esNatural ? place.name : null,
      company:    esNatural ? null       : place.name,
      phone:      place.phone      ?? null,
      website:    place.website    ?? null,
      location:   place.address    ?? null,
      industry:   (place.types ?? []).slice(0, 3).join(', ') || null,
      status:     'new',
      raw_data:   { google_types: place.types, address: place.address, tipo_persona: opts.personaTipo ?? 'juridica', ...opts.extraData },
    });

    if (!error) saved++;
  }

  if (opts.qualifyWithAi && saved > 0) {
    qualifyAllNew(sourceId).catch((e) => console.error('[google-maps] error calificando:', e));
  }

  return { found: places.length, saved, sourceId };
}

async function searchPlaces(query: string, maxResults: number, apiKey: string): Promise<PlaceResult[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type':     'application/json',
      'X-Goog-Api-Key':   apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.nationalPhoneNumber,places.websiteUri,places.formattedAddress,places.types',
    },
    body: JSON.stringify({
      textQuery:  query,
      maxResultCount: Math.min(maxResults, 20),
      languageCode: 'es',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Places API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json() as {
    places?: Array<{
      displayName?: { text?: string };
      nationalPhoneNumber?: string;
      websiteUri?: string;
      formattedAddress?: string;
      types?: string[];
    }>;
  };

  return (data.places ?? []).map((p) => ({
    name:    p.displayName?.text ?? 'Sin nombre',
    phone:   p.nationalPhoneNumber,
    website: p.websiteUri,
    address: p.formattedAddress,
    types:   p.types,
  }));
}
