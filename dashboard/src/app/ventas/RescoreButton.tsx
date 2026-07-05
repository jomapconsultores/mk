'use client';

import { useState } from 'react';

export default function RescoreButton({
  contactId,
  stage,
  backendUrl,
}: {
  contactId: string;
  stage: string;
  backendUrl: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recalificar una venta cerrada o un lead perdido no tiene sentido y arriesga
  // sobrescribir esa etapa si la IA falla — el backend también lo rechaza (defensa
  // en profundidad), pero ni siquiera mostramos el botón en esos casos.
  if (stage === 'customer' || stage === 'lost') return null;

  async function run(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/leads/rescore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contactId }),
      });
      const data = await res.json();
      if (data.ok) {
        window.location.reload();
      } else {
        setError(data.error ?? 'No se pudo recalcular el score.');
      }
    } catch {
      setError('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={run}
        disabled={loading}
        style={{
          background: loading ? 'var(--panel-2)' : 'var(--brand)',
          color: '#fff',
          border: 'none',
          padding: '4px 10px',
          borderRadius: 8,
          fontSize: 11,
          fontWeight: 600,
          cursor: loading ? 'wait' : 'pointer',
        }}
      >
        {loading ? '⏳ Calculando...' : '🤖 Recalcular score'}
      </button>
      {error && <span style={{ fontSize: 10.5, color: '#ef4444' }}>{error}</span>}
    </span>
  );
}
