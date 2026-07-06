import { redirect } from 'next/navigation';
import { requireAccess } from '@/lib/access';

export default async function ImportPage() {
  await requireAccess('captacion.prospeccion');
  redirect('/prospeccion?tab=csv');
}
