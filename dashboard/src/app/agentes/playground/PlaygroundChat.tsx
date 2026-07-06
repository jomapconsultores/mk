'use client';

import { useState, type FormEvent } from 'react';

type AgentOption = { id: string; name: string; status: 'draft' | 'published' };
type Turn = { role: 'user' | 'assistant'; text: string };

export default function PlaygroundChat({
  agents,
  initialAgentId,
  backendUrl,
}: {
  agents: AgentOption[];
  initialAgentId?: string;
  backendUrl: string;
}) {
  const [agentId, setAgentId] = useState(
    initialAgentId && agents.some((a) => a.id === initialAgentId) ? initialAgentId : agents[0]?.id ?? '',
  );
  const [history, setHistory] = useState<Turn[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function clearConversation() {
    setHistory([]);
    setError(null);
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text || !agentId || loading) return;

    const historyForRequest = history; // snapshot antes de agregar el mensaje nuevo
    setHistory((prev) => [...prev, { role: 'user', text }]);
    setMessage('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${backendUrl}/agents/playground`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, message: text, history: historyForRequest }),
      });
      const data = await res.json();
      if (data.ok) {
        setHistory((prev) => [...prev, { role: 'assistant', text: data.reply }]);
      } else {
        setError(data.error ?? 'No se pudo obtener respuesta del agente.');
      }
    } catch {
      setError('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  }

  if (agents.length === 0) {
    return (
      <p className="empty">
        Aún no hay agentes configurados. Creá uno primero en «Gestión de agentes».
      </p>
    );
  }

  const selected = agents.find((a) => a.id === agentId);

  return (
    <div className="section">
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label>Agente a probar</label>
          <select
            value={agentId}
            onChange={(e) => {
              setAgentId(e.target.value);
              clearConversation();
            }}
            style={{ marginBottom: 0 }}
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.status === 'published' ? '· 🟢 Publicado' : '· ⚪ Borrador'}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={clearConversation}
          style={{ background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
        >
          Limpiar conversación
        </button>
      </div>

      {selected && (
        <p style={{ color: 'var(--muted)', fontSize: 12.5, marginBottom: 16 }}>
          Estás probando <strong style={{ color: 'var(--text)' }}>{selected.name}</strong>. Escribí como si fueras el cliente.
        </p>
      )}

      <div style={{ marginBottom: 16, minHeight: 80 }}>
        {history.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>Escribí un mensaje abajo para empezar la conversación de prueba.</p>
        ) : (
          history.map((turn, i) => (
            <div key={i} className={`msg ${turn.role === 'user' ? 'inbound' : 'outbound'}`}>
              {turn.text}
              <div className="meta">{turn.role === 'user' ? '⬅️ Cliente (vos, de prueba)' : '🤖 Agente'}</div>
            </div>
          ))
        )}
        {loading && <div className="msg outbound" style={{ opacity: 0.6 }}>⏳ Pensando…</div>}
      </div>

      {error && (
        <div
          style={{
            marginBottom: 16, padding: '12px 16px', background: 'rgba(239,68,68,0.1)',
            border: '1px solid #ef4444', borderRadius: 10, color: '#ef4444', fontSize: 13,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={send} style={{ display: 'flex', gap: 8 }}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Escribí un mensaje como si fueras el cliente…"
          style={{ marginBottom: 0 }}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !message.trim()}>
          {loading ? 'Enviando…' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}
