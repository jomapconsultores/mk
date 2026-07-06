import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/access';
import { MODULES } from '@/lib/modules';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) redirect(process.env.LANDING_URL ?? '/');

  // Antes esto redirigía siempre a /leads en duro. "Tablero" (este "/") es en
  // realidad un alias de Clientes en la app actual (no hay contenido propio),
  // así que se prioriza igual, pero solo si el usuario tiene ese permiso —
  // si no, se lo lleva al primer submódulo al que sí tenga acceso, o a
  // /sin-acceso si no tiene ninguno (en vez de rebotarlo a una página que de
  // todas formas lo iba a bloquear sin explicación).
  if (user.permissions.has('ventas.clientes')) redirect('/leads');

  const fallback = MODULES.flatMap((g) => g.submodules).find(
    (s) => s.path !== '/' && user.permissions.has(s.key),
  );
  redirect(fallback ? fallback.path : '/sin-acceso');
}
