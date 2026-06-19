'use client';

import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', ico: '📊', label: 'Tablero' },
  { href: '/leads', ico: '👥', label: 'Clientes' },
  { href: '/products', ico: '📦', label: 'Productos' },
  { href: '/sequences', ico: '🔁', label: 'Seguimientos' },
  { href: '/sistemas', ico: '🌐', label: 'Mis sistemas' },
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
