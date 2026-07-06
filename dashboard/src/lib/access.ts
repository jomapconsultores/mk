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
  const { data, error } = await db
    .from('users')
    .select(
      `
      id, full_name, is_active,
      user_roles!user_id ( roles ( key, label, role_module_access ( submodule_key ) ) )
    `,
    )
    .eq('email', session.email)
    .maybeSingle();
  // OJO: user_roles!user_id (no solo "user_roles") es obligatorio. user_roles
  // tiene DOS foreign keys hacia users (user_id y granted_by, ver
  // db/add_permissions.sql) — sin el hint, PostgREST no puede resolver cual de
  // las dos usar para el embed y responde un error "ambiguous relationship"
  // (PGRST201) en vez de filas. Eso rompia el login de TODO usuario (con o sin
  // roles), porque `data` llegaba undefined y esta funcion devolvia null como
  // si nadie tuviera sesion.
  if (error) console.error('[getCurrentUser] error consultando users/user_roles:', error.message);

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
