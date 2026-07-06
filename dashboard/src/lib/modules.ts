// Fuente única de verdad para los módulos/submódulos del panel.
// La usan: el nav (Nav.tsx/layout.tsx), la página de administración de
// permisos (/usuarios) y, del lado de base de datos, el CHECK de
// user_module_access.submodule_key debe mantenerse en sincronía con
// ALL_SUBMODULE_KEYS.

export type Submodule = { key: string; label: string; path: string };
export type ModuleGroup = { key: string; label: string; submodules: Submodule[] };

export const MODULES: ModuleGroup[] = [
  {
    key: 'captacion',
    label: 'Captación y prospección',
    submodules: [
      { key: 'captacion.activa', label: 'Captación activa', path: '/captacion' },
      { key: 'captacion.prospeccion', label: 'Prospección · Importar', path: '/prospeccion' },
    ],
  },
  {
    key: 'ventas',
    label: 'Ventas y clientes',
    submodules: [
      { key: 'ventas.pipeline', label: 'Pipeline de ventas', path: '/ventas' },
      { key: 'ventas.clientes', label: 'Clientes', path: '/leads' },
    ],
  },
  {
    key: 'automatizacion',
    label: 'Automatización',
    submodules: [
      { key: 'automatizacion.seguimientos', label: 'Seguimientos', path: '/sequences' },
    ],
  },
  {
    key: 'analitica',
    label: 'Analítica',
    submodules: [
      { key: 'analitica.tablero', label: 'Tablero', path: '/' },
      { key: 'analitica.tendencias', label: 'Tendencias', path: '/tendencias' },
      { key: 'analitica.audiencias', label: 'Audiencias', path: '/audiencias' },
    ],
  },
  {
    key: 'configuracion',
    label: 'Configuración',
    submodules: [
      { key: 'configuracion.productos', label: 'Productos', path: '/products' },
      { key: 'configuracion.sistemas', label: 'Mis sistemas', path: '/sistemas' },
    ],
  },
];

export const ALL_SUBMODULE_KEYS = MODULES.flatMap((m) => m.submodules.map((s) => s.key));

// Rutas dinámicas/alias que heredan el permiso del módulo padre.
const PATH_ALIASES: Record<string, string> = {
  '/leads/': 'ventas.clientes', // /leads/[id]
  '/products/': 'configuracion.productos', // /products/[id]
  '/import': 'captacion.prospeccion', // alias legacy -> Prospección
};

export function submoduleForPath(pathname: string): string | null {
  if (pathname === '/') return 'analitica.tablero';
  for (const [prefix, key] of Object.entries(PATH_ALIASES)) {
    if (pathname === prefix || pathname.startsWith(prefix)) return key;
  }
  for (const g of MODULES) {
    for (const s of g.submodules) {
      if (s.path !== '/' && pathname.startsWith(s.path)) return s.key;
    }
  }
  return null;
}
