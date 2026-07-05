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

  async function run(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
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
      }
    } finally {
      setLoading(false);
    }
  }

  return (
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
  );
}
