// Réplica mínima de signSession (src/lib/auth.ts) para firmar cookies de sesión en tests e2e.

export const SESSION_COOKIE = 'mm_session';

function toB64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function signSession(email: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(email));
  return `${toB64url(new TextEncoder().encode(email))}.${toB64url(new Uint8Array(sig))}`;
}
