'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/supabase-admin';
import { SESSION_COOKIE, signSession } from '@/lib/auth';

/** Inicia sesión: valida email registrado + contraseña compartida del equipo. */
export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (password !== (process.env.DASHBOARD_PASSWORD ?? '')) {
    redirect('/login?error=1');
  }

  const db = getAdmin();
  const { data } = await db
    .from('users')
    .select('email, is_active')
    .eq('email', email)
    .maybeSingle();

  if (!data || !data.is_active) {
    redirect('/login?error=2');
  }

  const token = await signSession(email, process.env.SESSION_SECRET ?? '');
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 días
  });
  redirect('/');
}

/** Cierra sesión. */
export async function logout() {
  cookies().set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  redirect('/login');
}
