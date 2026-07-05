'use client';

import { Fragment } from 'react';
import { usePathname } from 'next/navigation';

const NAV_GROUPS = [
  {
    sectionLabel: 'Captación y prospección',
    items: [
      { href: '/captacion',   ico: '🌐', label: 'Captación activa' },
      { href: '/prospeccion', ico: '🔍', label: 'Prospección · Importar' },
    ],
  },
  {
    sectionLabel: 'Ventas y clientes',
    items: [
      { href: '/ventas', ico: '🧭', label: 'Pipeline de ventas' },
      { href: '/leads',  ico: '👥', label: 'Clientes' },
    ],
  },
  {
    sectionLabel: 'Automatización',
    items: [
      { href: '/sequences', ico: '🔁', label: 'Seguimientos' },
    ],
  },
  {
    sectionLabel: 'Analítica',
    items: [
      { href: '/',           ico: '📊', label: 'Tablero' },
      { href: '/tendencias', ico: '📈', label: 'Tendencias' },
      { href: '/audiencias', ico: '🎯', label: 'Audiencias' },
    ],
  },
  {
    sectionLabel: 'Configuración',
    items: [
      { href: '/products', ico: '📦', label: 'Productos' },
      { href: '/sistemas', ico: '⚙️', label: 'Mis sistemas' },
    ],
  },
];

export default function Nav() {
  const path = usePathname();
  const isActive = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  return (
    <nav className="nav">
      {NAV_GROUPS.map((group) => (
        <Fragment key={group.sectionLabel}>
          <div className="nav-section">{group.sectionLabel}</div>
          {group.items.map((l) => (
            <a key={l.href} href={l.href} className={isActive(l.href) ? 'active' : ''}>
              <span className="ico">{l.ico}</span>
              <span>{l.label}</span>
            </a>
          ))}
        </Fragment>
      ))}
    </nav>
  );
}
