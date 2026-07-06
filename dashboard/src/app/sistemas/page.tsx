import { requireAccess } from '@/lib/access';

export const dynamic = 'force-dynamic';

// Tus sistemas. Edita esta lista para agregar, quitar o renombrar accesos.
// Cada uno migró de Render a Coolify con su propio dominio — agrega la url
// (https://...) en cuanto esté confirmado para reactivar el acceso directo.
const SISTEMAS = [
  { name: 'Agente MAP', url: '', desc: 'Agente IA', icon: '🤖' },
  { name: 'Tributos', url: '', desc: 'Sistema tributario / contable', icon: '📑' },
  { name: 'Jomap Sistema', url: '', desc: 'Gestión Jomap', icon: '🗂️' },
  { name: 'Calendarios MAP', url: 'https://calendario.pensamiento-libre.org', desc: 'Calendarios', icon: '📅' },
  { name: 'Atlas Sistema', url: '', desc: 'Atlas', icon: '🌎' },
  { name: 'Pensamiento Libre', url: '', desc: 'Pensamiento Libre', icon: '💡' },
  { name: 'Fundación Pensamiento Libre', url: '', desc: 'ERP Fundación', icon: '🏛️' },
];

export default async function SistemasPage() {
  await requireAccess('configuracion.sistemas');
  return (
    <>
      <h2>Mis sistemas</h2>
      <p className="subtitle">Accede a todas tus aplicaciones desde un solo lugar.</p>

      <div className="cards">
        {SISTEMAS.map((s) =>
          s.url ? (
            <a
              key={s.name}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card"
              style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
            >
              <div style={{ fontSize: 32 }}>{s.icon}</div>
              <div className="num" style={{ fontSize: 18, marginTop: 8 }}>{s.name}</div>
              <div className="lbl">{s.desc}</div>
              <div style={{ marginTop: 10, color: 'var(--brand-2)', fontSize: 13 }}>Abrir ↗</div>
            </a>
          ) : (
            <div key={s.name} className="card" style={{ opacity: 0.6 }}>
              <div style={{ fontSize: 32 }}>{s.icon}</div>
              <div className="num" style={{ fontSize: 18, marginTop: 8 }}>{s.name}</div>
              <div className="lbl">{s.desc}</div>
              <div style={{ marginTop: 10, color: 'var(--text-secondary, #888)', fontSize: 13 }}>Pendiente dominio Coolify</div>
            </div>
          )
        )}
      </div>
    </>
  );
}
