import { importContacts } from './actions';

export const dynamic = 'force-dynamic';

export default function ImportPage({ searchParams }: { searchParams: { ok?: string; dup?: string; err?: string } }) {
  const ok  = searchParams.ok;
  const dup = searchParams.dup;
  const err = searchParams.err;

  const errorMsg =
    err === 'consent' ? 'Debes confirmar que tienes el consentimiento de los contactos.'
    : err === 'empty' ? 'No se encontraron contactos. Revisa el archivo o el texto pegado.'
    : null;

  return (
    <>
      <h2>Importar clientes existentes</h2>
      <p className="subtitle">Sube tu base de clientes actuales (CSV) al CRM. Se agregan sin duplicados.</p>

      {ok !== undefined && (
        <div className="section" style={{ borderColor: '#bbf7d0', background: '#f0fdf4' }}>
          ✅ <strong>{ok}</strong> contactos importados correctamente.
          {dup && Number(dup) > 0
            ? <> Se omitieron <strong>{dup}</strong> repetidos (ya existían en el sistema).</>
            : null}
        </div>
      )}
      {errorMsg && (
        <div className="section" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="section">
        <h3>1. Prepara tu archivo CSV</h3>
        <p style={{ color: 'var(--muted)', marginBottom: 12 }}>
          La primera fila debe ser el encabezado con los nombres de las columnas.
          Se reconocen automáticamente en cualquier orden:
        </p>
        <table>
          <thead><tr><th>Campo</th><th>Nombres de columna que reconoce</th></tr></thead>
          <tbody>
            <tr><td>Nombre completo</td><td><code>nombre, name, cliente, contacto, completo</code></td></tr>
            <tr><td>Correo electrónico</td><td><code>email, correo, mail</code></td></tr>
            <tr><td>Celular / WhatsApp</td><td><code>movil, celular, cel, whatsapp, telefono, phone</code></td></tr>
            <tr><td>Teléfono casa</td><td><code>casa, domicilio, hogar, home</code></td></tr>
            <tr><td>Teléfono trabajo</td><td><code>trabajo, oficina, work, laboral</code></td></tr>
          </tbody>
        </table>
        <p style={{ color: 'var(--muted)', marginTop: 12, fontSize: 13 }}>
          Ejemplo de primera fila:&nbsp;
          <code style={{ background: 'var(--panel-2)', padding: '2px 6px', borderRadius: 6 }}>
            nombre,correo,celular,casa,trabajo
          </code>
        </p>
      </div>

      <div className="section">
        <h3>2. Sube o pega los contactos</h3>
        <form action={importContacts}>
          <label>Archivo CSV</label>
          <input type="file" name="file" accept=".csv,text/csv" />

          <label style={{ marginTop: 8 }}>…o pega aquí los datos directamente</label>
          <textarea
            name="pasted"
            rows={6}
            placeholder={'nombre,correo,celular,casa,trabajo\nJuan Pérez,juan@mail.com,0991234567,022345678,'}
          />

          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontWeight: 500, marginTop: 6 }}>
            <input type="checkbox" name="consent" value="1" style={{ width: 'auto', marginTop: 3 }} />
            <span>
              Confirmo que tengo el <strong>consentimiento</strong> o una relación previa con estos contactos,
              y que puedo guardarlos conforme a la <strong>Ley de Protección de Datos (LOPDP)</strong>.
            </span>
          </label>

          <button type="submit" style={{ marginTop: 8 }}>Importar contactos</button>
        </form>
      </div>

      <div className="section">
        <h3>¿Tienes PDF, Excel o una lista desordenada?</h3>
        <p style={{ color: 'var(--muted)' }}>
          Usa el <strong>importador inteligente con IA</strong> en el módulo{' '}
          <a href="/prospeccion">Prospección</a> — acepta cualquier formato y extrae los datos automáticamente
          sin necesidad de preparar el archivo.
        </p>
      </div>
    </>
  );
}
