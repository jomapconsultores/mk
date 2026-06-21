'use client';
import { useState } from 'react';

export default function QualifyButton({
  pendingCount,
  backendUrl,
}: {
  pendingCount: number;
  backendUrl: string;
}) {
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<{ processed: number; qualified: number; errors: number } | null>(null);

  if (pendingCount === 0) return null;

  async function run() {
    setRunning(true);
    setStats(null);
    let totalProcessed = 0;
    let totalQualified = 0;
    let totalErrors = 0;

    try {
      while (true) {
        const res = await fetch(`${backendUrl}/prospecting/qualify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch_size: 20 }),
        });
        if (!res.ok) break;
        const data = await res.json();
        totalProcessed += data.processed ?? 0;
        totalQualified += data.qualified ?? 0;
        totalErrors    += data.errors    ?? 0;
        if ((data.processed ?? 0) === 0) break;
      }
    } finally {
      setRunning(false);
      setStats({ processed: totalProcessed, qualified: totalQualified, errors: totalErrors });
      if (totalQualified > 0) setTimeout(() => window.location.reload(), 1500);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <button
        onClick={run}
        disabled={running}
        style={{
          background: running ? 'var(--panel-2)' : '#4f46e5',
          color: '#fff',
          border: 'none',
          padding: '8px 18px',
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 13,
          cursor: running ? 'wait' : 'pointer',
        }}
      >
        {running ? '⏳ Calificando...' : `🤖 Calificar ${pendingCount} prospectos pendientes`}
      </button>
      {stats && (
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          ✓ {stats.qualified} calificados · {stats.errors} errores
        </span>
      )}
    </div>
  );
}
