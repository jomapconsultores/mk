import { NextRequest, NextResponse } from 'next/server';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { cookies } from 'next/headers';
import { getAdmin } from '@/lib/supabase-admin';
import { SESSION_COOKIE, signSession } from '@/lib/auth';
import { defaultActiveRole } from '@/lib/roles';

const RP_NAME = 'Marketing MAP';
const RP_ID   = process.env.WEBAUTHN_RP_ID   ?? 'localhost';
const ORIGIN  = process.env.WEBAUTHN_ORIGIN  ?? 'http://localhost:3000';
const CH_COOKIE = 'wbn_ch';

/** POST → genera opciones de registro */
export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'email requerido' }, { status: 400 });

  const db = getAdmin();
  const { data: user } = await db
    .from('users')
    .select('id, email, full_name, is_active')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (!user?.is_active) {
    return NextResponse.json({ error: 'Usuario no encontrado o inactivo' }, { status: 404 });
  }

  const { data: existing } = await db
    .from('user_webauthn_credentials')
    .select('credential_id, transports')
    .eq('user_email', email.toLowerCase());

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID:   RP_ID,
    userName:        email.toLowerCase(),
    userDisplayName: user.full_name ?? email,
    attestationType: 'none',
    excludeCredentials: (existing ?? []).map((c) => ({
      id: c.credential_id,
      transports: c.transports ?? [],
    })),
    authenticatorSelection: {
      residentKey:      'preferred',
      userVerification: 'preferred',
    },
  });

  const res = NextResponse.json({ options });
  res.cookies.set(CH_COOKIE, JSON.stringify({ ch: options.challenge, email: email.toLowerCase() }), {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   300,
    path:     '/',
  });
  return res;
}

/** PUT → verifica el registro y crea sesión */
export async function PUT(req: NextRequest) {
  const { email, credential } = await req.json();
  const raw = cookies().get(CH_COOKIE)?.value;
  if (!raw) return NextResponse.json({ error: 'Challenge expirado, inténtalo de nuevo' }, { status: 400 });

  const { ch: challenge, email: chEmail } = JSON.parse(raw);
  if (chEmail !== email?.toLowerCase()) {
    return NextResponse.json({ error: 'Email no coincide' }, { status: 400 });
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response:          credential,
      expectedChallenge: challenge,
      expectedOrigin:    ORIGIN,
      expectedRPID:      RP_ID,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'Verificación biométrica fallida' }, { status: 400 });
  }

  const { credential: cred } = verification.registrationInfo;
  const db = getAdmin();

  const { error: dbErr } = await db.from('user_webauthn_credentials').insert({
    user_email:    email.toLowerCase(),
    credential_id: cred.id,
    public_key:    Buffer.from(cred.publicKey).toString('base64url'),
    counter:       cred.counter,
    transports:    credential.response?.transports ?? [],
  });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  const { data: registeredUser } = await db
    .from('users')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  const { data: urows } = registeredUser
    ? await db.from('user_roles').select('roles(key)').eq('user_id', registeredUser.id)
    : { data: null };
  const roleKeys = (urows ?? []).map((r: any) => r.roles.key);
  const role = defaultActiveRole(roleKeys);
  if (!role) return NextResponse.json({ error: 'Usuario sin roles asignados' }, { status: 403 });

  const token = await signSession(email.toLowerCase(), role, process.env.SESSION_SECRET ?? '');
  const res   = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 30,
    path:     '/',
  });
  res.cookies.delete(CH_COOKIE);
  return res;
}
