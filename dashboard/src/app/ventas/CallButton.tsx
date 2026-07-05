'use client';

import { useState } from 'react';

export default function CallButton({
  contactId,
  backendUrl,
}: {
  contactId: string;
  backendUrl: string;
}) {
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/calls/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contactId }),
      });
      const data = await res.json();
      if (data.ok) {
        setStarted(true);
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setError(data.error ?? 'No se pudo iniciar la llamada.');
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
        disabled={loading || started}
        style={{
          background: loading || started ? 'var(--panel-2)' : 'var(--brand)',
          color: '#fff',
          border: 'none',
          padding: '4px 10px',
          borderRadius: 8,
          fontSize: 11,
          fontWeight: 600,
          cursor: loading || started ? 'wait' : 'pointer',
          marginLeft: 6,
        }}
      >
        {started ? 'Llamada iniciada ☎️' : loading ? '⏳ Llamando...' : '☎️ Llamar con IA'}
      </button>
      {error && <span style={{ fontSize: 10.5, color: '#ef4444', marginLeft: 6 }}>{error}</span>}
    </span>
  );
}
