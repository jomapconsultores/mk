export const dynamic = 'force-dynamic';

// Tus sistemas. Edita esta lista para agregar, quitar o renombrar accesos.
const SISTEMAS = [
  { name: 'Agente MAP', url: 'https://agente-map.onrender.com', desc: 'Agente IA', icon: '🤖' },
  { name: 'Tributos', url: 'https://tributos-web.onrender.com', desc: 'Sistema tributario / contable', icon: '📑' },
  { name: 'Jomap Sistema', url: 'https://jomap-sistema.onrender.com', desc: 'Gestión Jomap', icon: '🗂️' },
  { name: 'Calendarios MAP', url: 'https://calendarios-map.onrender.com', desc: 'Calendarios', icon: '📅' },
  { name: 'Atlas Sistema', url: 'https://atlas-sistema.onrender.com', desc: 'Atlas', icon: '🌎' },
  { name: 'Pensamiento Libre', url: 'https://pensamiento-libre.onrender.com', desc: 'Pensamiento Libre', icon: '💡' },
  { name: 'Fundación Pensamiento Libre', url: 'https://fundacion-pensamiento-erp.onrender.com', desc: 'ERP Fundación', icon: '🏛️' },
];

export default function SistemasPage() {
  return (
    <>
      <h2>Mis sistemas</h2>
      <p className="subtitle">Accede a todas tus aplicaciones desde un solo lugar.</p>

      <div className="cards">
        {SISTEMAS.map((s) => (
          <a
            key={s.url}
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
        ))}
      </div>
    </>
  );
}
