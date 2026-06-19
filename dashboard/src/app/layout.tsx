import './globals.css';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import Nav from './Nav';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';
import { getAdmin } from '@/lib/supabase-admin';
import { logout } from './login/actions';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata = {
  title: 'marketing-map · Panel',
  description: 'Sistema de captación y gestión de clientes con IA',
};

const ROLE_LABEL: Record<string, string> = { admin: 'Administrador', socia: 'Socia', agent: 'Asesor' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const email = await verifySession(token, process.env.SESSION_SECRET ?? '');

  let displayName = email ?? '';
  let role = '';
  if (email) {
    const { data } = await getAdmin().from('users').select('full_name, role').eq('email', email).maybeSingle();
    if (data?.full_name) displayName = data.full_name;
    if (data?.role) role = ROLE_LABEL[data.role] ?? data.role;
  }

  return (
    <html lang="es" className={inter.variable}>
      <body>
        {email ? (
          <div className="app">
            <aside className="sidebar">
              <div className="brand">
                <div className="mark">m</div>
                <div>
                  <div className="name">marketing-map</div>
                  <div className="tag">Captación con IA</div>
                </div>
              </div>
              <Nav />
              <div className="sidebar-foot">© marketing-map · Powered by IA</div>
            </aside>

            <div className="content">
              <header className="topbar">
                <span className="title">Panel de control</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span className="status-pill"><span className="dot" /> Sistema activo</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {displayName}{role ? ` · ${role}` : ''}
                  </span>
                  <form action={logout}>
                    <button type="submit" style={{ background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--border)', padding: '7px 14px' }}>
                      Salir
                    </button>
                  </form>
                </div>
              </header>
              <main className="main">{children}</main>
            </div>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
