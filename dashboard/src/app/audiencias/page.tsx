import { getAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

async function count(type?: 'customers') {
  const db = getAdmin();
  let q = db.from('contacts').select('id', { count: 'exact', head: true }).eq('marketing_opted_out', false);
  if (type === 'customers') q = q.eq('stage', 'customer');
  const { count } = await q;
  return count ?? 0;
}

export default async function AudienciasPage() {
  const [total, customers] = await Promise.all([count(), count('customers')]);

  return (
    <>
      <h2>Audiencias para anuncios</h2>
      <p className="subtitle">
        Exporta tus contactos para subirlos a Meta o Google Ads y crear audiencias “lookalike”
        (gente parecida a tus clientes). Es la forma legal y efectiva de captar personas afines.
      </p>

      <div className="cards">
        <div className="card">
          <div className="num">{total}</div>
          <div className="lbl">Contactos consentidos (sin baja)</div>
          <a href="/api/export?type=all" style={{ display: 'inline-block', marginTop: 12 }}>
            <button>⬇️ Descargar todos</button>
          </a>
        </div>
        <div className="card">
          <div className="num">{customers}</div>
          <div className="lbl">Clientes ganados (mejor semilla)</div>
          <a href="/api/export?type=customers" style={{ display: 'inline-block', marginTop: 12 }}>
            <button>⬇️ Descargar clientes</button>
          </a>
        </div>
      </div>

      <div className="section">
        <h3>Cómo usar el archivo</h3>
        <p style={{ marginBottom: 10, color: 'var(--muted)' }}>El CSV incluye: email, teléfono, nombre y apellido. Solo contactos que NO se dieron de baja.</p>
        <p style={{ lineHeight: 1.9 }}>
          <strong>Meta (Instagram/Facebook):</strong> Administrador de anuncios → <em>Audiencias</em> → Crear
          <strong> Audiencia personalizada</strong> → <em>Lista de clientes</em> → sube el CSV. Luego crea una
          <strong> Audiencia similar (lookalike)</strong> a partir de ella.<br />
          <strong>Google Ads:</strong> Herramientas → <em>Administrador de audiencias</em> → Segmentos de datos
          propios → sube el CSV → usa “segmentos similares”.
        </p>
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>
          🔒 Las plataformas cifran (hash) los datos al subirlos; tú no expones nada de más. Usa esto solo con
          contactos que consintieron, conforme a la LOPDP.
        </p>
      </div>
    </>
  );
}
