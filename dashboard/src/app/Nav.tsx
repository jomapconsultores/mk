'use client';

import { useEffect, useState, type ReactNode } from 'react';
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

// Ícono y etiqueta corta de cada módulo para la primera columna (el riel).
// La etiqueta larga del grupo se muestra como título de la segunda columna.
const GROUPS: Record<string, { icon: string; short: string }> = {
  captacion: { icon: '🎣', short: 'Captación' },
  ventas: { icon: '💼', short: 'Ventas' },
  automatizacion: { icon: '⚡', short: 'Automatiz.' },
  analitica: { icon: '📊', short: 'Analítica' },
  configuracion: { icon: '⚙️', short: 'Config.' },
  agentes: { icon: '🤖', short: 'Agentes IA' },
};

export default function Nav({
  permissions,
  isAdmin,
  brand,
  foot,
}: {
  permissions: string[];
  isAdmin: boolean;
  brand?: ReactNode;
  foot?: ReactNode;
}) {
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

  // El grupo que se despliega es el que el usuario abrió a mano (openKey) o,
  // si no abrió ninguno, el grupo al que pertenece la página actual.
  const activeKey = groups.find((g) => g.submodules.some((s) => isActive(s.path)))?.key ?? groups[0]?.key;
  const [openKey, setOpenKey] = useState<string | null>(null);

  // Al navegar, se suelta la selección manual: vuelve a mandar la ruta actual
  // (y en móvil eso cierra el desplegable, que allí flota sobre el contenido).
  useEffect(() => {
    setOpenKey(null);
  }, [path]);

  const currentKey = openKey ?? activeKey;
  const current = groups.find((g) => g.key === currentKey) ?? groups[0];

  return (
    <>
      <div className="rail">
        {brand}
        <div className="rail-items">
          {groups.map((group) => {
            const meta = GROUPS[group.key] ?? { icon: '📁', short: group.label };
            const selected = group.key === currentKey;
            const hasActivePage = group.submodules.some((s) => isActive(s.path));
            return (
              <button
                key={group.key}
                type="button"
                title={group.label}
                aria-expanded={selected}
                className={`rail-item${selected ? ' selected' : ''}${hasActivePage ? ' current' : ''}`}
                onClick={() => setOpenKey(group.key)}
              >
                <span className="ico">{meta.icon}</span>
                <span className="rail-label">{meta.short}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`subnav${openKey ? ' open' : ''}`}>
        <div className="nav-section">{current?.label}</div>
        <nav className="nav">
          {current?.submodules.map((s) => (
            <a key={s.key} href={s.path} className={isActive(s.path) ? 'active' : ''}>
              <span className="ico">{ICONS[s.key] ?? '👤'}</span>
              <span>{s.label}</span>
            </a>
          ))}
        </nav>
        {foot}
      </div>
    </>
  );
}
