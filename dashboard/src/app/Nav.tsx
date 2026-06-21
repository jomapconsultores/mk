'use client';

import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', ico: '📊', label: 'Tablero' },
  { href: '/leads', ico: '👥', label: 'Clientes' },
  { href: '/import', ico: '📥', label: 'Importar clientes' },
  { href: '/prospeccion', ico: '🔍', label: 'Prospección' },
  { href: '/captacion', ico: '🌐', label: 'Captación activa' },
  { href: '/sequences', ico: '🔁', label: 'Seguimientos' },
  { href: '/tendencias', ico: '📈', label: 'Tendencias' },
  { href: '/audiencias', ico: '🎯', label: 'Audiencias' },
  { href: '/sistemas', ico: '🌐', label: 'Mis sistemas' },
  { href: '/products', ico: '📦', label: 'Productos' },
];

export default function Nav() {
  const path = usePathname();
  const isActive = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  return (
    <nav className="nav">
      <div className="nav-section">Principal</div>
      {LINKS.map((l) => (
        <a key={l.href} href={l.href} className={isActive(l.href) ? 'active' : ''}>
          <span className="ico">{l.ico}</span>
          <span>{l.label}</span>
        </a>
      ))}
    </nav>
  );
}
