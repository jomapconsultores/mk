import { importContacts } from './actions';

export const dynamic = 'force-dynamic';

export default function ImportPage({ searchParams }: { searchParams: { ok?: string; dup?: string; err?: string } }) {
  const ok = searchParams.ok;
  const dup = searchParams.dup;
  const err = searchParams.err;

  const errorMsg =
    err === 'consent' ? 'Debes confirmar que tienes el consentimiento de los contactos.'
    : err === 'empty' ? 'No se encontraron contactos. Revisa el archivo o el texto pegado.'
    : null;

  return (
    <>
      <h2>Importar contactos</h2>
      <p className="subtitle">Sube tu base de clientes (Excel guardado como CSV) o pega los datos. Se agregan al CRM.</p>

      {ok !== undefined && (
        <div className="section" style={{ borderColor: '#bbf7d0', background: '#f0fdf4' }}>
          ✅ <strong>{ok}</strong> contactos importados.
          {dup && Number(dup) > 0 ? <> Se omitieron <strong>{dup}</strong> repetidos (ya existían).</> : null}
        </div>
      )}
      {errorMsg && (
        <div className="section" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c' }}>
          ⚠️ {errorMsg}
        </div>
      )}

      <div className="section">
        <h3>1. Prepara tu archivo</h3>
        <p style={{ color: 'var(--muted)', marginBottom: 12 }}>
          La primera fila deben ser los títulos de columna. Se reconocen automáticamente (en cualquier orden):
        </p>
        <table>
          <thead><tr><th>Columna</th><th>Títulos que reconoce</th></tr></thead>
          <tbody>
            <tr><td>Nombre completo</td><td>nombre, name, cliente</td></tr>
            <tr><td>Correo</td><td>email, correo</td></tr>
            <tr><td>Móvil / WhatsApp</td><td>movil, celular, whatsapp, telefono</td></tr>
            <tr><td>Teléfono casa</td><td>casa, domicilio, hogar</td></tr>
            <tr><td>Teléfono trabajo</td><td>trabajo, oficina, laboral</td></tr>
          </tbody>
        </table>
        <p style={{ color: 'var(--muted)', marginTop: 12, fontSize: 13 }}>
          Ejemplo:&nbsp;
          <code style={{ background: 'var(--panel-2)', padding: '2px 6px', borderRadius: 6 }}>
            nombre,correo,movil,casa,trabajo
          </code>
        </p>
      </div>

      <div className="section">
        <h3>2. Sube o pega tus contactos</h3>
        <form action={importContacts}>
          <label>Archivo CSV</label>
          <input type="file" name="file" accept=".csv,text/csv" />
          <label style={{ marginTop: 8 }}>…o pega aquí los datos (separados por comas)</label>
          <textarea name="pasted" rows={6} placeholder={'nombre,correo,movil,casa,trabajo\nJuan Pérez,juan@mail.com,+593990000000,072800000,'} />

          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontWeight: 500, marginTop: 6 }}>
            <input type="checkbox" name="consent" value="1" style={{ width: 'auto', marginTop: 3 }} />
            <span>Confirmo que tengo el <strong>consentimiento</strong> o una relación previa con estos contactos, y que puedo guardarlos conforme a la Ley de Protección de Datos (LOPDP).</span>
          </label>

          <button type="submit">Importar contactos</button>
        </form>
      </div>
    </>
  );
}
