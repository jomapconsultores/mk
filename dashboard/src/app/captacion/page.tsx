import { requireAccess } from '@/lib/access';
import CaptacionClient from './CaptacionClient';

export const dynamic = 'force-dynamic';

// Server Component: solo verifica el permiso (server-only, Node.js runtime)
// antes de renderizar la UI interactiva, que se movió a CaptacionClient.tsx
// ('use client' no admite componentes async, así que el guard no puede vivir
// en el mismo archivo que la UI cliente).
export default async function CaptacionPage() {
  await requireAccess('captacion.activa');
  return <CaptacionClient />;
}
