import { redirect } from 'next/navigation';
export default function ImportPage() {
  redirect('/prospeccion?tab=csv');
}
