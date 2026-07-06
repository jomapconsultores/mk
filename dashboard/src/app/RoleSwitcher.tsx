'use client';

import { usePathname } from 'next/navigation';
import { switchActiveRole } from '@/lib/role-switch';

export default function RoleSwitcher({
  roles,
  activeRole,
}: {
  roles: { key: string; label: string }[];
  activeRole: string;
}) {
  const pathname = usePathname();
  return (
    <select
      defaultValue={activeRole}
      onChange={(e) => switchActiveRole(e.target.value, pathname)}
      style={{ marginLeft: 8 }}
    >
      {roles.map((r) => (
        <option key={r.key} value={r.key}>
          {r.label}
        </option>
      ))}
    </select>
  );
}
