import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';

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
  return NextResponse.next();
}

export const config = {
  // Excluye assets estáticos de /public (tienen extensión, ej. .png/.svg/.json/.js)
  // además de _next/static, _next/image y favicon.ico.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)'],
};
