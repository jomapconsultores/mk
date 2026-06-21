import ContactDropzone from './ContactDropzone';

export const dynamic = 'force-dynamic';

export default function ImportPage({
  searchParams,
}: {
  searchParams: { ok?: string; dup?: string; err?: string };
}) {
  const ok  = searchParams.ok;
  const dup = searchParams.dup;
  const err = searchParams.err;

  const errorMsg =
    err === 'consent' ? 'Debes confirmar que tienes el consentimiento de los contactos.'
    : err === 'empty' ? 'No se encontraron contactos válidos. Revisa que el archivo tenga encabezado y datos.'
    : null;

  return (
    <>
      <h2>Importar clientes existentes</h2>
      <p className="subtitle">
        Arrastra tu base de clientes (CSV) o pégala directamente. Se agregan sin duplicados al CRM.
      </p>

      {/* Resultado de importación */}
      {ok !== undefined && (
        <div className="section" style={{ borderColor: '#bbf7d0', background: '#f0fdf4', marginBottom: 20 }}>
          ✅ <strong>{ok}</strong> contactos importados correctamente.
          {dup && Number(dup) > 0
            ? <> Se omitieron <strong>{dup}</strong> duplicados (ya existían en el sistema).</>
            : null}
        </div>
      )}

      {errorMsg && (
        <div className="section" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#b91c1c', marginBottom: 20 }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Formulario con drag & drop */}
      <div className="section">
        <ContactDropzone />
      </div>

      {/* Referencia de columnas */}
      <div className="section">
        <h3>Columnas que reconoce automáticamente</h3>
        <p style={{ color: 'var(--muted)', marginBottom: 12, fontSize: 13 }}>
          La primera fila debe ser el encabezado. Se detectan en cualquier orden e idioma:
        </p>
        <table>
          <thead>
            <tr><th>Campo</th><th>Nombres de columna aceptados</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Nombre completo</td>
              <td><code>nombre, name, cliente, contacto, completo</code></td>
            </tr>
            <tr>
              <td>Correo electrónico</td>
              <td><code>email, correo, mail</code></td>
            </tr>
            <tr>
              <td>Celular / WhatsApp</td>
              <td><code>movil, celular, cel, whatsapp, telefono, phone</code></td>
            </tr>
            <tr>
              <td>Teléfono convencional</td>
              <td><code>casa, domicilio, hogar, home</code></td>
            </tr>
            <tr>
              <td>Teléfono trabajo</td>
              <td><code>trabajo, oficina, work, laboral</code></td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginTop: 14, fontSize: 13, color: 'var(--muted)' }}>
          Ejemplo de primera fila:{' '}
          <code style={{ background: 'var(--panel-2)', padding: '2px 6px', borderRadius: 6 }}>
            nombre,correo,celular,casa,trabajo
          </code>
        </p>
      </div>

      {/* Referencia al importador IA */}
      <div className="section">
        <h3>¿Tienes PDF, Excel o una lista sin formato?</h3>
        <p style={{ color: 'var(--muted)' }}>
          Usa el <strong>importador inteligente con IA</strong> en{' '}
          <a href="/prospeccion">Prospección</a> — acepta PDF, Excel (.xlsx) y CSV sin necesidad de preparar el archivo.
          La IA extrae nombres, apellidos, teléfonos y correos automáticamente.
        </p>
      </div>
    </>
  );
}
