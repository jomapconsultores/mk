// Resuelve "quién es el usuario actual y qué puede ver" para Server
// Components / Route Handlers (Node.js runtime, no Edge). Server-only:
// depende de next/headers (cookies()), que ya falla en build si se
// importa desde un client component.
//
// Memoizado por request con React.cache: aunque layout.tsx Y el page.tsx
// de la ruta lo llamen cada uno, solo se dispara UNA consulta a Supabase
// por navegación.
//
// Modelo de roles múltiples: un usuario puede tener 2+ roles asignados
// (user_roles), pero los permisos de CADA request se resuelven contra el
// ROL ACTIVO de la sesión (el firmado en la cookie), no contra la unión de
// todos sus roles. Ver dashboard/src/lib/auth.ts y role-switch.ts.
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';
import { getAdmin } from '@/lib/supabase-admin';
import { ALL_SUBMODULE_KEYS } from '@/lib/modules';
import { defaultActiveRole } from '@/lib/roles';

export type RoleRef = { key: string; label: string };

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  activeRole: string; // key del rol activo en esta sesión
  activeRoleLabel: string;
  roles: RoleRef[]; // TODOS los roles asignados (para el selector; length>1 → mostrar selector)
  isAdmin: boolean; // activeRole === 'admin'
  permissions: Set<string>;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = await verifySession(token, process.env.SESSION_SECRET ?? '');
  if (!session) return null;

  const db = getAdmin();
  const { data } = await db
    .from('users')
    .select(
      `
      id, full_name, is_active,
      user_roles ( roles ( key, label, role_module_access ( submodule_key ) ) )
    `,
    )
    .eq('email', session.email)
    .maybeSingle();

  if (!data || data.is_active === false) return null;

  const roleEntries = ((data.user_roles ?? []) as Array<{ roles: any }>).map((ur) => ur.roles);
  const roleKeys = roleEntries.map((r: any) => r.key);
  if (roleKeys.length === 0) return null; // sin roles asignados = sin acceso

  // Si el rol de la cookie ya no está asignado (fue revocado), no se confía en él:
  // se recalcula para ESTE request con el default; el próximo switch/login corrige la cookie.
  const activeRoleKey = roleKeys.includes(session.role) ? session.role : defaultActiveRole(roleKeys)!;
  const activeRoleEntry = roleEntries.find((r: any) => r.key === activeRoleKey)!;

  const isAdmin = activeRoleKey === 'admin';
  const permissions = new Set<string>(
    isAdmin
      ? ALL_SUBMODULE_KEYS
      : (activeRoleEntry.role_module_access ?? []).map((a: any) => a.submodule_key),
  );

  return {
    id: data.id,
    email: session.email,
    fullName: data.full_name ?? '',
    activeRole: activeRoleKey,
    activeRoleLabel: activeRoleEntry.label,
    roles: roleEntries.map((r: any) => ({ key: r.key, label: r.label })),
    isAdmin,
    permissions,
  };
});

export const hasAccess = (u: CurrentUser, key: string): boolean => u.isAdmin || u.permissions.has(key);

/** Bloquea entrar por URL directa: redirige a /login (sin sesión) o /sin-acceso (sin permiso). */
export async function requireAccess(submoduleKey: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!hasAccess(user, submoduleKey)) redirect('/sin-acceso');
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.isAdmin) redirect('/sin-acceso');
  return user;
}
