import { NextRequest, NextResponse } from 'next/server';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { cookies } from 'next/headers';
import { getAdmin } from '@/lib/supabase-admin';
import { SESSION_COOKIE, signSession } from '@/lib/auth';

const RP_ID  = process.env.WEBAUTHN_RP_ID  ?? 'localhost';
const ORIGIN = process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:3000';
const CH_COOKIE = 'wbn_ch';

/** POST → genera opciones de autenticación */
export async function POST(req: NextRequest) {
  const { email } = await req.json();
  const db = getAdmin();

  const { data: creds } = await db
    .from('user_webauthn_credentials')
    .select('credential_id, transports')
    .eq('user_email', email?.toLowerCase() ?? '');

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: (creds ?? []).map((c) => ({
      id: c.credential_id,
      transports: c.transports ?? [],
    })),
    userVerification: 'preferred',
  });

  const res = NextResponse.json({ options });
  res.cookies.set(CH_COOKIE, JSON.stringify({ ch: options.challenge, email: email?.toLowerCase() ?? '' }), {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   300,
    path:     '/',
  });
  return res;
}

/** PUT → verifica autenticación biométrica y crea sesión */
export async function PUT(req: NextRequest) {
  const { assertion } = await req.json();
  const raw = cookies().get(CH_COOKIE)?.value;
  if (!raw) return NextResponse.json({ error: 'Challenge expirado, inténtalo de nuevo' }, { status: 400 });

  const { ch: challenge } = JSON.parse(raw);
  const db = getAdmin();

  const { data: stored } = await db
    .from('user_webauthn_credentials')
    .select('*')
    .eq('credential_id', assertion.id)
    .maybeSingle();

  if (!stored) return NextResponse.json({ error: 'Credencial no encontrada en este dispositivo' }, { status: 404 });

  const { data: user } = await db
    .from('users')
    .select('is_active')
    .eq('email', stored.user_email)
    .maybeSingle();

  if (!user?.is_active) return NextResponse.json({ error: 'Usuario inactivo' }, { status: 403 });

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response:          assertion,
      expectedChallenge: challenge,
      expectedOrigin:    ORIGIN,
      expectedRPID:      RP_ID,
      credential: {
        id:         stored.credential_id,
        publicKey:  Uint8Array.from(Buffer.from(stored.public_key, 'base64url')),
        counter:    stored.counter,
        transports: stored.transports ?? [],
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  if (!verification.verified) {
    return NextResponse.json({ error: 'Verificación biométrica fallida' }, { status: 400 });
  }

  await db
    .from('user_webauthn_credentials')
    .update({ counter: verification.authenticationInfo.newCounter })
    .eq('credential_id', assertion.id);

  const token = await signSession(stored.user_email, process.env.SESSION_SECRET ?? '');
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
