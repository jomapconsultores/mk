import { getAdmin } from '@/lib/supabase-admin';
import { requireAccess } from '@/lib/access';
import WizardSteps from '../WizardSteps';

export const dynamic = 'force-dynamic';

type AgentRecord = {
  id: string;
  name: string;
  instructions: string;
  capabilities: string[];
  status: 'draft' | 'published';
  published_at: string | null;
};

export default async function AgentWizardPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { step?: string };
}) {
  await requireAccess('agentes.gestion');
  const db = getAdmin();
  const { data: agent } = await db
    .from('ai_agents')
    .select('id, name, instructions, capabilities, status, published_at')
    .eq('id', params.id)
    .maybeSingle();

  if (!agent) return <p className="empty">Agente no encontrado.</p>;

  const rawStep = Number(searchParams.step ?? '1');
  const initialStep = Number.isFinite(rawStep) ? Math.min(4, Math.max(1, rawStep)) : 1;

  return (
    <>
      <p style={{ marginBottom: 12 }}><a href="/agentes">← Volver a agentes</a></p>
      <h2>{agent.name}</h2>
      <p className="subtitle">
        Configurá personalidad, comportamiento y capacidades de este agente. Los cambios no afectan
        producción hasta que lo publiques.
      </p>
      <WizardSteps agent={agent as AgentRecord} initialStep={initialStep} />
    </>
  );
}
