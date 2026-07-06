'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/supabase-admin';
import { SESSION_COOKIE, signSession, verifyPassword } from '@/lib/auth';
import { defaultActiveRole } from '@/lib/roles';

/** Inicia sesión: valida email registrado y su contraseña (propia o, si no tiene, la compartida). */
export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  const db = getAdmin();
  const { data } = await db
    .from('users')
    .select('id, email, is_active, password_hash')
    .eq('email', email)
    .maybeSingle();

  if (!data || !data.is_active) {
    redirect('/login?error=2');
  }

  // Contraseña propia del usuario si la tiene; si no, la contraseña compartida del equipo.
  const ok = data.password_hash
    ? await verifyPassword(password, data.password_hash)
    : password === (process.env.DASHBOARD_PASSWORD ?? '');
  if (!ok) {
    redirect('/login?error=1');
  }

  const { data: urows } = await db.from('user_roles').select('roles(key)').eq('user_id', data.id);
  const roleKeys = (urows ?? []).map((r: any) => r.roles.key);
  const role = defaultActiveRole(roleKeys);
  if (!role) redirect('/login?error=3'); // usuario sin roles asignados

  const token = await signSession(email, role, process.env.SESSION_SECRET ?? '');
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
