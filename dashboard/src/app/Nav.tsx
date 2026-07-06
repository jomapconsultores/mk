'use client';

import { Fragment } from 'react';
import { usePathname } from 'next/navigation';
import { MODULES } from '@/lib/modules';

const ICONS: Record<string, string> = {
  'captacion.activa': '🌐',
  'captacion.prospeccion': '🔍',
  'ventas.pipeline': '🧭',
  'ventas.clientes': '👥',
  'ventas.pedidos': '🧾',
  'automatizacion.seguimientos': '🔁',
  'analitica.tablero': '📊',
  'analitica.tendencias': '📈',
  'analitica.audiencias': '🎯',
  'configuracion.productos': '📦',
  'configuracion.sistemas': '⚙️',
  'agentes.gestion': '🤖',
  'agentes.playground': '🧪',
};

export default function Nav({ permissions, isAdmin }: { permissions: string[]; isAdmin: boolean }) {
  const path = usePathname();
  const allowed = new Set(permissions);
  const isActive = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  // Filtra submódulos sin permiso y descarta el grupo entero si queda vacío.
  // La administración de permisos (solo admin) vive dentro de "Configuración".
  const groups = MODULES.map((group) => {
    const submodules = group.submodules.filter((s) => isAdmin || allowed.has(s.key));
    if (group.key === 'configuracion' && isAdmin) {
      submodules.push({ key: 'configuracion.usuarios', label: 'Usuarios y permisos', path: '/usuarios' });
    }
    return { ...group, submodules };
  }).filter((group) => group.submodules.length > 0);

  return (
    <nav className="nav">
      {groups.map((group) => (
        <Fragment key={group.key}>
          <div className="nav-section">{group.label}</div>
          {group.submodules.map((s) => (
            <a key={s.key} href={s.path} className={isActive(s.path) ? 'active' : ''}>
              <span className="ico">{ICONS[s.key] ?? '👤'}</span>
              <span>{s.label}</span>
            </a>
          ))}
        </Fragment>
      ))}
    </nav>
  );
}
