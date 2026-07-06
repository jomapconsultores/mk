import Link from 'next/link';
import { getAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/access';
import { MODULES } from '@/lib/modules';
import { setRoleAccess, grantAllForRole, revokeAllForRole } from './actions';

export const dynamic = 'force-dynamic';

type RoleRow = {
  id: string;
  key: string;
  label: string;
  role_module_access: { submodule_key: string }[] | null;
};

export default async function RolesAccessPage() {
  await requireAdmin();

  const db = getAdmin();
  const { data } = await db
    .from('roles')
    .select('id, key, label, role_module_access(submodule_key)')
    .order('key', { ascending: true });

  const allRoles = (data ?? []) as unknown as RoleRow[];
  const editableRoles = allRoles.filter((r) => r.key !== 'admin');

  return (
    <>
      <h2>Accesos por rol</h2>
      <p className="subtitle">
        Elegí qué módulos y submódulos puede ver y usar cada rol. Estos accesos aplican a todas las
        personas que actúen con ese rol.
      </p>
      <p style={{ marginBottom: 20 }}>
        <Link href="/usuarios">← Volver a usuarios y roles</Link>
      </p>

      <p className="empty" style={{ padding: 16, marginBottom: 20 }}>
        Admin: acceso total automático a todos los módulos, no configurable.
      </p>

      {editableRoles.map((r) => {
        const granted = new Set((r.role_module_access ?? []).map((a) => a.submodule_key));

        return (
          <div className="section" key={r.id}>
            <h3>{r.label}</h3>

            <form action={setRoleAccess.bind(null, r.id)}>
              <table>
                <thead>
                  <tr>
                    <th>Módulo</th>
                    <th>Submódulo</th>
                    <th style={{ width: 90 }}>Acceso</th>
                  </tr>
                </thead>
                <tbody>
                  {MODULES.flatMap((group) =>
                    group.submodules.map((s, i) => (
                      <tr key={s.key}>
                        {i === 0 && <td rowSpan={group.submodules.length}>{group.label}</td>}
                        <td>{s.label}</td>
                        <td>
                          <input
                            type="checkbox"
                            name="submodule_key"
                            value={s.key}
                            defaultChecked={granted.has(s.key)}
                            style={{ width: 18, height: 18, margin: 0 }}
                          />
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>

              <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                <button type="submit">Guardar</button>
                <button
                  type="submit"
                  formAction={grantAllForRole.bind(null, r.id)}
                  style={{ background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                >
                  Marcar todo
                </button>
                <button type="submit" formAction={revokeAllForRole.bind(null, r.id)} className="danger">
                  Quitar todo
                </button>
              </div>
            </form>
          </div>
        );
      })}

      {editableRoles.length === 0 && <p className="empty">No hay roles configurables todavía.</p>}
    </>
  );
}
