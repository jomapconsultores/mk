import { getAdmin } from '@/lib/supabase-admin';
import { requireAccess } from '@/lib/access';
import { fmtDate } from '@/lib/format';
import { createAgentDraft, publishAgent, unpublishAgent } from './actions';

export const dynamic = 'force-dynamic';

type AgentRow = {
  id: string;
  name: string;
  status: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
};

export default async function AgentsPage() {
  await requireAccess('agentes.gestion');
  const db = getAdmin();
  const { data: agents } = await db
    .from('ai_agents')
    .select('id, name, status, published_at, created_at')
    .order('created_at', { ascending: false });

  const rows = (agents ?? []) as AgentRow[];

  return (
    <>
      <h2>Agentes IA</h2>
      <p className="subtitle">
        Personalidad, comportamiento y capacidades del asistente que responde WhatsApp y llamadas.
        Solo un agente puede estar publicado (en producción) a la vez.
      </p>

      <div className="section">
        <h3>Nuevo agente</h3>
        <form action={createAgentDraft}>
          <label>Nombre *</label>
          <input name="name" required placeholder="Ej: Vendedor WhatsApp v2" />
          <button type="submit">Crear y configurar</button>
        </form>
      </div>

      <div className="section">
        <h3>Agentes configurados</h3>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Estado</th>
              <th>Publicado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td><strong>{a.name}</strong></td>
                <td>
                  <span className="badge" style={{ background: a.status === 'published' ? '#22c55e' : '#64748b' }}>
                    {a.status === 'published' ? '🟢 Publicado' : '⚪ Borrador'}
                  </span>
                </td>
                <td>{a.status === 'published' ? fmtDate(a.published_at) : '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <a href={`/agentes/${a.id}`} className="badge" style={{ background: '#6366f1' }}>Editar</a>
                    <a href={`/agentes/playground?agent=${a.id}`} className="badge" style={{ background: '#0ea5e9' }}>Probar</a>
                    {a.status === 'published' ? (
                      <form action={unpublishAgent.bind(null, a.id)}>
                        <button type="submit" style={{ background: '#475569' }}>Despublicar</button>
                      </form>
                    ) : (
                      <form action={publishAgent.bind(null, a.id)}>
                        <button type="submit" style={{ background: '#22c55e' }}>Publicar</button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="empty">Aún no hay agentes. Crea el primero arriba ☝️</p>}
      </div>
    </>
  );
}
