'use client';

import { useRef, useState, DragEvent, ChangeEvent } from 'react';
import { importContacts } from './actions';

const ACCEPT = '.csv,.txt,text/csv,text/plain';

export default function ContactDropzone() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText]     = useState('');
  const [filename, setFilename]   = useState<string | null>(null);
  const [rowCount, setRowCount]   = useState<number | null>(null);
  const [dragging, setDragging]   = useState(false);
  const [loading, setLoading]     = useState(false);

  async function readFile(file: File) {
    setFilename(file.name);
    const text = await file.text();
    const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
    setCsvText(text);
    setRowCount(Math.max(0, lines.length - 1)); // excluding header
  }

  function handleDragOver(e: DragEvent)  { e.preventDefault(); setDragging(true); }
  function handleDragLeave()             { setDragging(false); }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) readFile(file);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  }

  function handleTextChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    setCsvText(text);
    const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
    setRowCount(text.trim() ? Math.max(0, lines.length - 1) : null);
    if (text.trim()) setFilename(null); // texto manual, no archivo
  }

  function handleReset() {
    setCsvText('');
    setFilename(null);
    setRowCount(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <form
      action={importContacts}
      onSubmit={() => setLoading(true)}
    >
      {/* ── Zona drag & drop ─────────────────────────────────────────── */}
      <div
        onClick={() => !filename && fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border:      `2px dashed ${dragging ? '#4f46e5' : filename ? '#22c55e' : 'var(--border)'}`,
          borderRadius: 12,
          padding:     '28px 24px',
          textAlign:   'center',
          cursor:      filename ? 'default' : 'pointer',
          background:  dragging ? 'rgba(79,70,229,.05)' : filename ? 'rgba(34,197,94,.05)' : 'var(--panel-2)',
          transition:  'all .2s',
          userSelect:  'none',
          marginBottom: 16,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {filename ? (
          /* Archivo cargado */
          <div>
            <div style={{ fontSize: 36, marginBottom: 6 }}>📊</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{filename}</div>
            {rowCount !== null && (
              <div style={{ fontSize: 13, color: '#15803d', fontWeight: 600, marginBottom: 8 }}>
                ✅ {rowCount} {rowCount === 1 ? 'contacto detectado' : 'contactos detectados'} (sin contar encabezado)
              </div>
            )}
            <button
              type="button"
              onClick={handleReset}
              style={{ background: '#475569', padding: '6px 14px', fontSize: 12 }}
            >
              Cambiar archivo
            </button>
          </div>
        ) : dragging ? (
          <div>
            <div style={{ fontSize: 40, marginBottom: 6 }}>📂</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Suelta el archivo aquí</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📂</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              Arrastra tu archivo CSV aquí
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
              o haz clic para seleccionar · formatos: CSV, TXT
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              ¿Tienes PDF o Excel? Usa el importador IA en{' '}
              <a href="/prospeccion" onClick={(e) => e.stopPropagation()}>Prospección</a>
            </div>
          </div>
        )}
      </div>

      {/* ── Vista previa del CSV / pegar texto ───────────────────────── */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ marginBottom: 6 }}>
          {filename
            ? 'Contenido del archivo (puedes editarlo antes de importar)'
            : 'O pega aquí los datos directamente'}
        </label>
        <textarea
          name="pasted"
          rows={csvText ? 6 : 4}
          value={csvText}
          onChange={handleTextChange}
          placeholder={'nombre,correo,celular,casa,trabajo\nJuan Pérez,juan@mail.com,0991234567,,'}
          style={{ fontFamily: 'monospace', fontSize: 12, marginBottom: 0 }}
        />
        {rowCount !== null && !filename && (
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            {rowCount} {rowCount === 1 ? 'fila de datos' : 'filas de datos'} detectadas
          </div>
        )}
      </div>

      {/* ── Consentimiento ───────────────────────────────────────────── */}
      <label style={{
        display:    'flex',
        gap:        10,
        alignItems: 'flex-start',
        fontWeight: 500,
        fontSize:   13,
        cursor:     'pointer',
        marginBottom: 16,
      }}>
        <input
          type="checkbox"
          name="consent"
          value="1"
          style={{ width: 'auto', marginTop: 2, flexShrink: 0 }}
        />
        <span>
          Confirmo que tengo el <strong>consentimiento</strong> o una relación previa con estos contactos,
          y que puedo guardarlos conforme a la <strong>Ley de Protección de Datos (LOPDP)</strong>.
        </span>
      </label>

      {/* ── Botón importar ───────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={loading || (!csvText.trim())}
        style={{
          width:      '100%',
          background: loading ? '#475569' : (!csvText.trim() ? '#94a3b8' : 'var(--brand)'),
          cursor:     loading || !csvText.trim() ? 'not-allowed' : 'pointer',
        }}
      >
        {loading
          ? '⏳ Importando…'
          : csvText.trim()
            ? `Importar ${rowCount !== null ? rowCount + ' contacto' + (rowCount !== 1 ? 's' : '') : 'contactos'}`
            : 'Arrastra un archivo o pega datos para continuar'}
      </button>
    </form>
  );
}
