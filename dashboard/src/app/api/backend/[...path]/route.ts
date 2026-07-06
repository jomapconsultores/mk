import { NextResponse } from 'next/server';
import { getCurrentUser, hasAccess } from '@/lib/access';

export const dynamic = 'force-dynamic';

/**
 * Prefijo de ruta del backend -> submódulo(s) que autorizan usarla. Si un
 * prefijo no aparece aquí, se asume que es sensible y solo el admin puede
 * llamarlo (falla cerrado, igual que la tabla user_module_access).
 * Completar contra las rutas reales de backend/src/server.ts.
 */
const PROXY_ACCESS: Record<string, string[]> = {
  'captacion/': ['captacion.activa'],
  'prospecting/': ['captacion.prospeccion'],
  // /leads/rescore y /calls/initiate se usan tanto desde el Kanban (pipeline)
  // como desde la ficha de cliente: cualquiera de los dos permisos alcanza.
  'leads/': ['ventas.pipeline', 'ventas.clientes'],
  'calls/': ['ventas.pipeline', 'ventas.clientes'],
  'sequences/': ['automatizacion.seguimientos'],
  'products/': ['configuracion.productos'],
  // Único prefijo de backend usado por el módulo de Agentes IA: el CRUD vive
  // como Server Actions Supabase-directo (dashboard/src/app/agentes/actions.ts);
  // solo la ejecución en vivo del LLM (Playground) pasa por el backend.
  'agents/': ['agentes.playground'],
};

function requiredKeysFor(path: string[]): string[] | null {
  const joined = path.join('/');
  for (const [prefix, keys] of Object.entries(PROXY_ACCESS)) {
    if (joined.startsWith(prefix)) return keys;
  }
  return null;
}

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
 *
 * Ocultar el menú y bloquear el page.tsx correspondiente no impide que
 * alguien golpee este endpoint directo desde la consola del navegador estando
 * logueado con una cuenta sin ese permiso — por eso el chequeo se repite acá
 * (misma fuente de permisos que las páginas, vía lib/access.ts), y no solo
 * como UX en el Nav.
 */
async function proxy(req: Request, path: string[]): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 });
  }

  const required = requiredKeysFor(path);
  const allowed = required ? required.some((key) => hasAccess(user, key)) : user.isAdmin;
  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: 'No tenés permiso para usar esta función.' },
      { status: 403 },
    );
  }

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
