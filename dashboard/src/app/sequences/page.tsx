import { getAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export default async function SequencesPage() {
  const db = getAdmin();
  const { data: sequences } = await db
    .from('sequences')
    .select('id, name, description, channel, is_active, trigger')
    .order('created_at', { ascending: true });

  const result = [];
  for (const s of sequences ?? []) {
    const { data: steps } = await db
      .from('sequence_steps')
      .select('step_order, delay_hours, message_template, ai_prompt')
      .eq('sequence_id', s.id)
      .order('step_order', { ascending: true });
    const { count: active } = await db
      .from('sequence_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('sequence_id', s.id)
      .eq('status', 'active');
    result.push({ s, steps: steps ?? [], active: active ?? 0 });
  }

  return (
    <>
      <h2>Seguimientos automáticos</h2>
      <p className="subtitle">Secuencias que persiguen a los clientes solos, respetando horarios y bajas.</p>

      {result.map(({ s, steps, active }) => (
        <div className="section" key={s.id}>
          <h3>{s.name} {s.is_active ? '✅' : '⏸️'}</h3>
          <p style={{ color: 'var(--muted)', marginBottom: 12 }}>
            {s.description} · Canal: <strong>{s.channel}</strong> · En curso ahora: <strong>{active}</strong> clientes
          </p>
          <table>
            <thead><tr><th>Paso</th><th>Cuándo</th><th>Mensaje</th></tr></thead>
            <tbody>
              {steps.map((st) => (
                <tr key={st.step_order}>
                  <td>{st.step_order}</td>
                  <td>+{st.delay_hours}h</td>
                  <td>{st.message_template ?? <em style={{ color: 'var(--brand-2)' }}>Redactado por IA: {st.ai_prompt}</em>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {result.length === 0 && <p className="empty">No hay secuencias configuradas.</p>}
    </>
  );
}
