import { getAdmin } from '@/lib/supabase-admin';
import { requireAccess } from '@/lib/access';
import PlaygroundChat from './PlaygroundChat';

export const dynamic = 'force-dynamic';

type AgentOption = { id: string; name: string; status: 'draft' | 'published' };

export default async function PlaygroundPage({ searchParams }: { searchParams: { agent?: string } }) {
  await requireAccess('agentes.playground');
  const db = getAdmin();
  const { data: agents } = await db
    .from('ai_agents')
    .select('id, name, status')
    .order('created_at', { ascending: false });

  return (
    <>
      <h2>Playground</h2>
      <p className="subtitle">
        Probá cualquier agente —borrador o publicado— con mensajes de prueba. Esta conversación vive
        solo en tu navegador: no toca contactos, conversaciones ni mensajes reales.
      </p>
      <PlaygroundChat
        agents={(agents ?? []) as AgentOption[]}
        initialAgentId={searchParams.agent}
        backendUrl="/api/backend"
      />
    </>
  );
}
