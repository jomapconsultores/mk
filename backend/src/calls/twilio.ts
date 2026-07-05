/**
 * Cliente HTTP "ligero" para la API de Twilio (sin el SDK oficial).
 * Estilo: fetch crudo, igual que channels/whatsapp.ts.
 *
 * Las credenciales se leen de process.env directamente (no de config.ts) para que
 * el servidor arranque sin problema aunque Twilio no esté configurado todavía en
 * producción: el error solo aparece al intentar iniciar una llamada.
 */

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';

interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

/** Lee y valida las credenciales de Twilio. Lanza un error claro si falta alguna. */
function getTwilioCredentials(): TwilioCredentials {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  const missing: string[] = [];
  if (!accountSid) missing.push('TWILIO_ACCOUNT_SID');
  if (!authToken)  missing.push('TWILIO_AUTH_TOKEN');
  if (!fromNumber) missing.push('TWILIO_PHONE_NUMBER');

  if (missing.length > 0) {
    throw new Error(
      `Faltan variables de entorno de Twilio: ${missing.join(', ')}. ` +
      'Configúralas para poder iniciar llamadas salientes.',
    );
  }

  return { accountSid: accountSid!, authToken: authToken!, fromNumber: fromNumber! };
}

export interface CreateOutboundCallResult {
  sid: string;
  status: string;
}

/**
 * Inicia una llamada saliente vía la API REST de Twilio.
 * `twimlUrl` es la URL que Twilio consultará para obtener el TwiML a ejecutar
 * (nuestro endpoint POST /calls/twiml, que a su vez apunta al WebSocket de ConversationRelay).
 */
export async function createOutboundCall(opts: {
  to: string;
  twimlUrl: string;
  statusCallbackUrl: string;
}): Promise<CreateOutboundCallResult> {
  const { accountSid, authToken, fromNumber } = getTwilioCredentials();

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const body = new URLSearchParams({
    To:   opts.to,
    From: fromNumber,
    Url:  opts.twimlUrl,
    StatusCallback: opts.statusCallbackUrl,
    StatusCallbackEvent: 'initiated ringing answered completed',
  });

  const res = await fetch(`${TWILIO_API_BASE}/Accounts/${accountSid}/Calls.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Twilio Calls API falló (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json() as { sid: string; status: string };
  return { sid: data.sid, status: data.status };
}
