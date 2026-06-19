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

  anthropic: {
    apiKey: required('ANTHROPIC_API_KEY'),
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
  },

  whatsapp: {
    token: process.env.WHATSAPP_TOKEN ?? '',
    phoneId: process.env.WHATSAPP_PHONE_ID ?? '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? '',
  },

  // Secreto para proteger el endpoint de cron que dispara el seguimiento.
  cronSecret: process.env.CRON_SECRET ?? '',
};
