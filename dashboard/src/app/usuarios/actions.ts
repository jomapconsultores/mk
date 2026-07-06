'use server';

import { getAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/access';
import { revalidatePath } from 'next/cache';

/** Reemplaza por completo los roles asignados a un usuario por la lista dada (checkboxes del formulario). */
export async function setUserRoles(targetUserId: string, formData: FormData) {
  const admin = await requireAdmin(); // redirige si quien llama no es admin

  const db = getAdmin();
  const { data: validRoles } = await db.from('roles').select('id, key');
  const validKeys = new Set((validRoles ?? []).map((r) => r.key));
  const grantedKeys = formData.getAll('role_key').map(String).filter((k) => validKeys.has(k));
  const roleIds = (validRoles ?? []).filter((r) => grantedKeys.includes(r.key)).map((r) => r.id);

  await db.from('user_roles').delete().eq('user_id', targetUserId);
  if (roleIds.length) {
    await db.from('user_roles').insert(
      roleIds.map((role_id) => ({ user_id: targetUserId, role_id, granted_by: admin.id })),
    );
  }
  revalidatePath('/usuarios');
}
