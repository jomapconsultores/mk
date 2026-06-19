// Sesión firmada con HMAC (funciona en Node y en el Edge runtime del middleware).
// El cookie guarda: base64url(email) + "." + base64url(HMAC_SHA256(email, SESSION_SECRET)).

const te = new TextEncoder();
const td = new TextDecoder();

function toB64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): string {
  const norm = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(norm);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return td.decode(bytes);
}

async function hmac(message: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, te.encode(message));
  return new Uint8Array(sig);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const SESSION_COOKIE = 'mm_session';

/** Crea el token de sesión firmado para un email. */
export async function signSession(email: string, secret: string): Promise<string> {
  const sig = toB64url(await hmac(email, secret));
  return toB64url(te.encode(email)) + '.' + sig;
}

// ---------- Cifrado de contraseñas por usuario (PBKDF2-SHA256) ----------
function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
}
function hexToBytes(h: string): Uint8Array {
  const a = new Uint8Array(h.length / 2);
  for (let i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16);
  return a;
}
async function pbkdf2Hex(password: string, saltHex: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', te.encode(password) as BufferSource, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: hexToBytes(saltHex) as BufferSource, iterations: 100000, hash: 'SHA-256' },
    k,
    256,
  );
  return bytesToHex(new Uint8Array(bits));
}

/** Genera "salt:hash" para guardar una contraseña. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = bytesToHex(salt);
  return saltHex + ':' + (await pbkdf2Hex(password, saltHex));
}

/** Verifica una contraseña contra el "salt:hash" guardado. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, h] = stored.split(':');
  if (!saltHex || !h) return false;
  return safeEqual(await pbkdf2Hex(password, saltHex), h);
}

/** Verifica el token; devuelve el email si es válido, o null. */
export async function verifySession(token: string | undefined, secret: string): Promise<string | null> {
  if (!token || !secret) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  let email: string;
  try {
    email = fromB64url(payload);
  } catch {
    return null;
  }
  const expected = toB64url(await hmac(email, secret));
  return safeEqual(sig, expected) ? email : null;
}
