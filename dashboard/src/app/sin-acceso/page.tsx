// Página neutral para usuarios autenticados sin permiso sobre la sección
// solicitada. Accesible sin requerir ningún permiso puntual (evita loops de
// redirect si a alguien le quitan hasta el Tablero).
export const dynamic = 'force-dynamic';

export default function SinAccesoPage() {
  return (
    <div className="section" style={{ textAlign: 'center', maxWidth: 480, margin: '40px auto' }}>
      <h2 style={{ marginBottom: 8 }}>Sin acceso</h2>
      <p className="subtitle" style={{ marginBottom: 0 }}>
        No tenés acceso a esta sección. Contactá a tu administrador si creés que esto es un error.
      </p>
    </div>
  );
}
