// Define la contraseña (cifrada PBKDF2-SHA256) de un usuario del panel.
// Uso: EMAIL=... NEWPASS=... PGHOST/PGUSER/PGPASSWORD=... node scripts/set-password.mjs
import pg from 'pg';

function bytesToHex(b) { return Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join(''); }
function hexToBytes(h) { const a = new Uint8Array(h.length / 2); for (let i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
async function pbkdf2Hex(password, saltHex) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: hexToBytes(saltHex), iterations: 100000, hash: 'SHA-256' }, k, 256);
  return bytesToHex(new Uint8Array(bits));
}

const email = process.env.EMAIL;
const pass = process.env.NEWPASS;
if (!email || !pass) { console.error('Faltan EMAIL o NEWPASS'); process.exit(1); }

const salt = crypto.getRandomValues(new Uint8Array(16));
const saltHex = bytesToHex(salt);
const stored = saltHex + ':' + (await pbkdf2Hex(pass, saltHex));

const c = new pg.Client({ host: process.env.PGHOST, port: 5432, user: process.env.PGUSER, password: process.env.PGPASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query('update users set password_hash=$1 where email=$2 returning email, role', [stored, email]);
console.log('Contraseña actualizada para:', r.rows);
await c.end();
