// Réplica mínima de signSession (src/lib/auth.ts) para firmar cookies de sesión en tests e2e.
// DEBE producir el MISMO formato que src/lib/auth.ts, o verifySession devolverá null
// y el middleware rebotará al usuario a /login:
//   base64url(JSON.stringify({email, role})) + "." + base64url(HMAC_SHA256(payload, SESSION_SECRET))

export const SESSION_COOKIE = 'mm_session';

function toB64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function signSession(email: string, role: string, secret: string): Promise<string> {
  const payload = JSON.stringify({ email, role });
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${toB64url(new TextEncoder().encode(payload))}.${toB64url(new Uint8Array(sig))}`;
}
