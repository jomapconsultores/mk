'use client';

import { useRef, useState, DragEvent, ChangeEvent } from 'react';

interface ImportResult {
  extracted: number;
  imported: number;
  duplicates: number;
  message: string;
}

const ACCEPT = '.pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv';

export default function ImportDropzone({ backendUrl }: { backendUrl: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging]     = useState(false);
  const [file, setFile]             = useState<File | null>(null);
  const [sourceName, setSourceName] = useState('');
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<ImportResult | null>(null);
  const [error, setError]           = useState<string | null>(null);

  function handleDragOver(e: DragEvent) { e.preventDefault(); setDragging(true); }
  function handleDragLeave()            { setDragging(false); }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) pickFile(dropped);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked) pickFile(picked);
  }

  function pickFile(f: File) {
    setFile(f);
    setResult(null);
    setError(null);
    if (!sourceName) setSourceName(f.name.replace(/\.[^.]+$/, ''));
  }

  async function handleSubmit() {
    if (!file) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('source_name', sourceName || file.name);

      const res = await fetch(`${backendUrl}/prospecting/import-smart`, {
        method: 'POST',
        body: fd,
      });
      const json = await res.json() as { ok: boolean; extracted?: number; imported?: number; duplicates?: number; message?: string; error?: string };

      if (json.ok) {
        setResult({
          extracted:  json.extracted  ?? 0,
          imported:   json.imported   ?? 0,
          duplicates: json.duplicates ?? 0,
          message:    json.message    ?? '',
        });
        setFile(null);
        setSourceName('');
        if (inputRef.current) inputRef.current.value = '';
      } else {
        setError(json.error ?? 'Error desconocido');
      }
    } catch (err) {
      setError('No se pudo conectar con el servidor: ' + String(err));
    } finally {
      setLoading(false);
    }
  }

  const fileExt = file?.name.split('.').pop()?.toUpperCase() ?? '';
  const fileIcon = fileExt === 'PDF' ? '📄' : fileExt === 'CSV' ? '📊' : '📗';

  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ marginBottom: 4 }}>Importar base de datos</h3>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        Arrastra o selecciona un archivo PDF, Excel (.xlsx) o CSV. La IA extrae automáticamente
        nombres, apellidos, teléfonos, correos y los clasifica con inteligencia artificial.
      </p>

      {/* Zona de drag & drop */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragging ? '#818cf8' : file ? '#22c55e' : 'var(--border)'}`,
          borderRadius: 12,
          padding: '32px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? 'rgba(129,140,248,0.06)' : file ? 'rgba(34,197,94,0.05)' : 'var(--panel)',
          transition: 'all 0.2s',
          userSelect: 'none',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {file ? (
          <>
            <div style={{ fontSize: 36, marginBottom: 8 }}>{fileIcon}</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{file.name}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {(file.size / 1024).toFixed(0)} KB · Haz clic para cambiar
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📂</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {dragging ? 'Suelta aquí el archivo' : 'Arrastra tu archivo aquí'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              o haz clic para seleccionar · PDF, Excel (.xlsx / .xls), CSV
            </div>
          </>
        )}
      </div>

      {/* Nombre de la base de datos */}
      {file && (
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
            Nombre de esta base de datos (para identificarla en el sistema)
          </label>
          <input
            type="text"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            placeholder="Ej: Clientes feria mayo 2025, Leads LinkedIn, Base cámara comercio…"
            style={{ width: '100%', marginBottom: 0 }}
          />
        </div>
      )}

      {/* Botón importar */}
      {file && (
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            marginTop: 12,
            width: '100%',
            background: loading ? '#475569' : '#818cf8',
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? '⏳ Extrayendo con IA… puede tardar unos segundos' : `Extraer e importar "${file.name}"`}
        </button>
      )}

      {/* Resultado exitoso */}
      {result && (
        <div style={{ marginTop: 16, padding: '16px 20px', background: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e', borderRadius: 10 }}>
          <div style={{ fontWeight: 700, color: '#22c55e', marginBottom: 8 }}>✅ Importación completada</div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div><span style={{ fontSize: 24, fontWeight: 700 }}>{result.extracted}</span><div style={{ fontSize: 12, color: 'var(--muted)' }}>Extraídos por IA</div></div>
            <div><span style={{ fontSize: 24, fontWeight: 700, color: '#22c55e' }}>{result.imported}</span><div style={{ fontSize: 12, color: 'var(--muted)' }}>Importados</div></div>
            <div><span style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>{result.duplicates}</span><div style={{ fontSize: 12, color: 'var(--muted)' }}>Duplicados omitidos</div></div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{result.message}</div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: 10, color: '#ef4444', fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Tipos de datos que extrae */}
      <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>La IA extrae automáticamente:</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['Nombres', 'Apellidos', 'Teléfono fijo', 'Celular', 'Email personal', 'Email institucional', 'Empresa', 'Ubicación', 'Sector'].map((tag) => (
            <span key={tag} className="badge" style={{ background: '#334155', fontSize: 11 }}>{tag}</span>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
          No importa el formato ni el orden de las columnas. La IA interpreta cualquier estructura.
        </div>
      </div>
    </div>
  );
}
