import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

/**
 * Cliente de Supabase con la "service key": tiene permisos totales.
 * USAR SOLO EN EL BACKEND, nunca exponer esta llave al navegador.
 */
export const db = createClient(config.supabase.url, config.supabase.serviceKey, {
  auth: { persistSession: false },
});
