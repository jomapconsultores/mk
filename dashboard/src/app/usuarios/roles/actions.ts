'use server';

import { getAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/access';
import { ALL_SUBMODULE_KEYS } from '@/lib/modules';
import { revalidatePath } from 'next/cache';

/** Reemplaza por completo los accesos de un rol por la lista dada (checkboxes del formulario). */
export async function setRoleAccess(roleId: string, formData: FormData) {
  await requireAdmin();
  const db = getAdmin();

  const { data: role } = await db.from('roles').select('key').eq('id', roleId).maybeSingle();
  if (!role || role.key === 'admin') return; // admin nunca es configurable

  const grantedKeys = formData
    .getAll('submodule_key')
    .map(String)
    .filter((k) => ALL_SUBMODULE_KEYS.includes(k));

  await db.from('role_module_access').delete().eq('role_id', roleId);
  if (grantedKeys.length) {
    await db.from('role_module_access').insert(
      grantedKeys.map((submodule_key) => ({ role_id: roleId, submodule_key })),
    );
  }
  revalidatePath('/usuarios/roles');
}

/** Otorga acceso a todos los submódulos para el rol dado. */
export async function grantAllForRole(roleId: string) {
  await requireAdmin();
  const db = getAdmin();

  const { data: role } = await db.from('roles').select('key').eq('id', roleId).maybeSingle();
  if (!role || role.key === 'admin') return;

  await db.from('role_module_access').delete().eq('role_id', roleId);
  await db.from('role_module_access').insert(
    ALL_SUBMODULE_KEYS.map((submodule_key) => ({ role_id: roleId, submodule_key })),
  );
  revalidatePath('/usuarios/roles');
}

/** Revoca todos los accesos del rol dado (sin filas = sin acceso). */
export async function revokeAllForRole(roleId: string) {
  await requireAdmin();
  const db = getAdmin();

  const { data: role } = await db.from('roles').select('key').eq('id', roleId).maybeSingle();
  if (!role || role.key === 'admin') return;

  await db.from('role_module_access').delete().eq('role_id', roleId);
  revalidatePath('/usuarios/roles');
}
