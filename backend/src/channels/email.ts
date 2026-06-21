import { config } from '../config.js';

/**
 * Envía un email transaccional vía Resend.
 * Requiere RESEND_API_KEY y RESEND_FROM_EMAIL en .env
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const apiKey = config.email.resendApiKey;
  const from   = config.email.fromAddress;

  if (!apiKey) throw new Error('Falta RESEND_API_KEY en .env');
  if (!from)   throw new Error('Falta RESEND_FROM_EMAIL en .env');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to: opts.to, subject: opts.subject, text: opts.text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend error ${res.status}: ${body.slice(0, 200)}`);
  }
}
