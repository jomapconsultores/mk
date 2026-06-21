import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rutas públicas (login, landing y assets ya se excluyen en el matcher).
  if (pathname === '/' || pathname.startsWith('/login')) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const email = await verifySession(token, process.env.SESSION_SECRET ?? '');

  if (!email) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
