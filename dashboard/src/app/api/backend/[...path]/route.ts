import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Proxy autenticado hacia el backend real. Esta ruta vive bajo /api/, así que
 * middleware.ts ya exige una sesión válida del panel antes de llegar aquí —
 * el secreto interno (INTERNAL_API_SECRET) se agrega recién en este punto,
 * server-side, y nunca se envía al navegador.
 *
 * Antes el navegador llamaba directo a NEXT_PUBLIC_BACKEND_URL, lo que dejaba
 * los endpoints de IA/Twilio/CRM del backend abiertos a cualquiera que
 * conociera esa URL (el backend valida el secreto, pero si el navegador nunca
 * lo tiene, ya no puede llegar por ahí sin pasar primero por la sesión del panel).
 */
async function proxy(req: Request, path: string[]): Promise<NextResponse> {
  const backendUrl = process.env.BACKEND_URL ?? '';
  const secret = process.env.INTERNAL_API_SECRET ?? '';
  if (!backendUrl || !secret) {
    return NextResponse.json(
      { ok: false, error: 'Proxy no configurado: falta BACKEND_URL o INTERNAL_API_SECRET en el dashboard.' },
      { status: 500 },
    );
  }

  const { search } = new URL(req.url);
  const target = `${backendUrl}/${path.join('/')}${search}`;

  const headers: Record<string, string> = { 'x-internal-secret': secret };
  const contentType = req.headers.get('content-type');
  if (contentType) headers['content-type'] = contentType;

  const init: RequestInit & { duplex?: 'half' } = { method: req.method, headers };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    // Se reenvía el cuerpo tal cual (JSON o multipart con su boundary original,
    // ej. la subida de archivos de /prospecting/import-smart) sin parsearlo.
    init.body = await req.arrayBuffer();
    init.duplex = 'half';
  }

  let res: Response;
  try {
    res = await fetch(target, init);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `No se pudo contactar al backend: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  const body = await res.arrayBuffer();
  return new NextResponse(body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
}

export async function GET(req: Request, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}

export async function POST(req: Request, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
