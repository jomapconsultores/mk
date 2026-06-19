import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/**
 * Cliente de Supabase con service_role. SOLO se usa en el servidor (server
 * components, server actions, route handlers). Nunca llega al navegador.
 */
export function getAdmin(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en el entorno del panel.');
  }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}
