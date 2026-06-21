import { login } from './actions';
import BiometricButton from './BiometricButton';

export const dynamic = 'force-dynamic';

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const error =
    searchParams.error === '1' ? 'Contraseña incorrecta.'
    : searchParams.error === '2' ? 'Este correo no está autorizado.'
    : null;

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand" style={{ display: 'block', textAlign: 'center', marginBottom: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/map-logo.png"
            alt="MAP Consultoría & Asesoría Marketing"
            style={{ width: 200, borderRadius: 10, display: 'block', margin: '0 auto 12px' }}
          />
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Desarrollado por <strong style={{ color: '#cbd5e1' }}>Marco Antonio Posligua San Martín</strong></div>
        </div>

        <h1>Iniciar sesión</h1>
        <p className="login-sub">Ingresa con biometría o con tu contraseña.</p>

        {error && <div className="login-error">{error}</div>}

        {/* Biometría (huella / rostro) */}
        <BiometricButton />

        {/* Formulario con contraseña */}
        <form action={login}>
          <label>Correo electrónico</label>
          <input name="email" type="email" required placeholder="tucorreo@ejemplo.com" />
          <label>Contraseña</label>
          <input name="password" type="password" required placeholder="••••••••" />
          <button type="submit">Entrar →</button>
        </form>
      </div>
      <p className="login-foot">© 2026 Marketing MAP · Desarrollado por Marco Antonio Posligua San Martín</p>
    </div>
  );
}
