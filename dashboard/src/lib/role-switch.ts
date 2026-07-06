'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/supabase-admin';
import { SESSION_COOKIE, signSession, verifySession } from '@/lib/auth';

/** Cambia el rol activo de la sesión, re-verificando server-side que el usuario aún lo tiene asignado. */
export async function switchActiveRole(newRoleKey: string, redirectTo: string) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = await verifySession(token, process.env.SESSION_SECRET ?? '');
  if (!session) redirect('/login');

  const db = getAdmin();
  const { data: user } = await db
    .from('users')
    .select('id, is_active')
    .eq('email', session.email)
    .maybeSingle();
  if (!user || !user.is_active) redirect('/login');

  // Chequeo server-side obligatorio: ¿el usuario REALMENTE tiene ese rol asignado?
  const { data: has } = await db
    .from('user_roles')
    .select('roles!inner(key)')
    .eq('user_id', user.id)
    .eq('roles.key', newRoleKey)
    .maybeSingle();
  if (!has) redirect(redirectTo); // rol inválido/ya no asignado: no-op, se ignora silenciosamente

  const newToken = await signSession(session.email, newRoleKey, process.env.SESSION_SECRET ?? '');
  cookies().set(SESSION_COOKIE, newToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(redirectTo);
}
