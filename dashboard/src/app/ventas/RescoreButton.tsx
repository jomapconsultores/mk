'use client';

import { useState } from 'react';

export default function RescoreButton({
  contactId,
  backendUrl,
}: {
  contactId: string;
  backendUrl: string;
}) {
  const [loading, setLoading] = useState(false);

  async function run(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/leads/rescore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contactId }),
      });
      const data = await res.json();
      if (data.ok) window.location.reload();
    } finally {
      setLoading(false);
    }
  }

  return (
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
  );
}
