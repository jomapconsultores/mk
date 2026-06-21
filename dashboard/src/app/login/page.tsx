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
        <div className="login-brand">
          <div className="mark">m</div>
          <div>
            <div className="name">Marketing MAP</div>
            <div className="tag">Panel de control</div>
          </div>
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
      <p className="login-foot">© Marketing MAP · Acceso restringido al equipo</p>
    </div>
  );
}
