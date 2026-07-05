'use client';

import { usePathname } from 'next/navigation';

const ADQUISICION = [
  { href: '/captacion',  ico: '🌐', label: 'Captación activa' },
  { href: '/prospeccion', ico: '🔍', label: 'Prospección · Importar' },
  { href: '/leads',      ico: '👥', label: 'Clientes' },
];

const GESTION = [
  { href: '/',           ico: '📊', label: 'Tablero' },
  { href: '/ventas',     ico: '🧭', label: 'Pipeline de ventas' },
  { href: '/sequences',  ico: '🔁', label: 'Seguimientos' },
  { href: '/tendencias', ico: '📈', label: 'Tendencias' },
  { href: '/audiencias', ico: '🎯', label: 'Audiencias' },
  { href: '/sistemas',   ico: '⚙️', label: 'Mis sistemas' },
  { href: '/products',   ico: '📦', label: 'Productos' },
];

export default function Nav() {
  const path = usePathname();
  const isActive = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  return (
    <nav className="nav">
      <div className="nav-section">Captación y CRM</div>
      {ADQUISICION.map((l) => (
        <a key={l.href} href={l.href} className={isActive(l.href) ? 'active' : ''}>
          <span className="ico">{l.ico}</span>
          <span>{l.label}</span>
        </a>
      ))}
      <div className="nav-section">Gestión</div>
      {GESTION.map((l) => (
        <a key={l.href} href={l.href} className={isActive(l.href) ? 'active' : ''}>
          <span className="ico">{l.ico}</span>
          <span>{l.label}</span>
        </a>
      ))}
    </nav>
  );
}
