import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession, verifySession } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rutas públicas (login, landing y assets ya se excluyen en el matcher).
  if (pathname === '/' || pathname.startsWith('/login')) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token, process.env.SESSION_SECRET ?? '');

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Sesión válida: reemite la cookie con timestamp fresco y maxAge de 30 min
  // (ventana deslizante). Si el usuario deja de navegar 30 min, la cookie
  // caduca y el próximo request lo manda a /login.
  const res = NextResponse.next();
  const fresh = await signSession(session.email, session.role, process.env.SESSION_SECRET ?? '');
  res.cookies.set(SESSION_COOKIE, fresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}

export const config = {
  // Excluye assets estáticos de /public (tienen extensión, ej. .png/.svg/.json/.js)
  // además de _next/static, _next/image y favicon.ico.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)'],
};
