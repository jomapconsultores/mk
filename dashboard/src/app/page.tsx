import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';
import LandingPage from './LandingPage';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const email = await verifySession(token, process.env.SESSION_SECRET ?? '');

  if (email) redirect('/leads');

  return <LandingPage />;
}
