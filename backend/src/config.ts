import 'dotenv/config';

/** Lee una variable de entorno obligatoria; falla claro si falta. */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}. Revisa tu archivo .env`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),

  supabase: {
    url: required('SUPABASE_URL'),
    serviceKey: required('SUPABASE_SERVICE_KEY'),
  },

  // Proveedores de IA — orden de preferencia: Mistral/Codestral → DeepSeek → Claude
  mistral: {
    apiKey:         process.env.MISTRAL_API_KEY    ?? '',
    codestralApiKey: process.env.CODESTRAL_API_KEY ?? '',
    model:          process.env.MISTRAL_MODEL      ?? 'mistral-small-latest',
    codeModel:      process.env.CODESTRAL_MODEL    ?? 'codestral-latest',
  },

  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY  ?? '',
    model:  process.env.DEEPSEEK_MODEL    ?? 'deepseek-chat',
  },

  // Claude se usa solo como último recurso
  anthropic: {
    apiKey: required('ANTHROPIC_API_KEY'),
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
  },

  whatsapp: {
    token: process.env.WHATSAPP_TOKEN ?? '',
    phoneId: process.env.WHATSAPP_PHONE_ID ?? '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? '',
  },

  // Email (Resend) — para outreach por correo
  email: {
    resendApiKey: process.env.RESEND_API_KEY   ?? '',
    fromAddress:  process.env.RESEND_FROM_EMAIL ?? '',
  },

  // Google Places — para scraping de negocios
  google: {
    placesApiKey: process.env.GOOGLE_PLACES_API_KEY ?? '',
  },

  // Secreto para proteger el endpoint de cron que dispara el seguimiento.
  cronSecret: process.env.CRON_SECRET ?? '',

  // Secreto compartido con el proxy server-side del dashboard (/api/backend/*)
  // para los endpoints que cuestan dinero (IA, Twilio) o exponen el CRM.
  internalApiSecret: process.env.INTERNAL_API_SECRET ?? '',
};
