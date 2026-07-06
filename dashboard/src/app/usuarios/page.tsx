import Link from 'next/link';
import { getAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/access';
import { setUserRoles } from './actions';

export const dynamic = 'force-dynamic';

type RoleRow = { id: string; key: string; label: string };

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  user_roles: { roles: { id: string; key: string; label: string } }[] | null;
};

export default async function UsuariosPage() {
  await requireAdmin();

  const db = getAdmin();
  const [{ data: rolesData }, { data: usersData }] = await Promise.all([
    db.from('roles').select('id, key, label').order('key', { ascending: true }),
    db
      .from('users')
      .select('id, email, full_name, is_active, user_roles(roles(id, key, label))')
      .order('full_name', { ascending: true }),
  ]);

  const roles = (rolesData ?? []) as RoleRow[];
  const users = (usersData ?? []) as unknown as UserRow[];

  return (
    <>
      <h2>Usuarios y roles</h2>
      <p className="subtitle">
        Elegí qué roles tiene cada persona. Un usuario puede tener más de un rol y elegir con cuál actuar
        desde el selector de la barra superior.
      </p>
      <p style={{ marginBottom: 20 }}>
        <Link href="/usuarios/roles">Configurar accesos por rol →</Link>
      </p>

      {users.map((u) => {
        const grantedKeys = new Set((u.user_roles ?? []).map((ur) => ur.roles.key));

        return (
          <div className="section" key={u.id}>
            <h3>
              {u.full_name || u.email}
              {!u.is_active && (
                <span className="badge" style={{ background: '#ef4444', marginLeft: 8 }}>
                  Inactivo
                </span>
              )}
            </h3>
            <p className="subtitle" style={{ marginBottom: 14 }}>{u.email}</p>

            <form action={setUserRoles.bind(null, u.id)}>
              <table>
                <thead>
                  <tr>
                    <th>Rol</th>
                    <th style={{ width: 90 }}>Asignado</th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r) => (
                    <tr key={r.id}>
                      <td>{r.label}</td>
                      <td>
                        <input
                          type="checkbox"
                          name="role_key"
                          value={r.key}
                          defaultChecked={grantedKeys.has(r.key)}
                          style={{ width: 18, height: 18, margin: 0 }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: 16 }}>
                <button type="submit">Guardar</button>
              </div>
            </form>
          </div>
        );
      })}

      {users.length === 0 && <p className="empty">No hay usuarios registrados todavía.</p>}
    </>
  );
}
