import './globals.css';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import Nav from './Nav';
import GuidePanel from './GuidePanel';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';
import { getAdmin } from '@/lib/supabase-admin';
import { logout } from './login/actions';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata = {
  title: 'Marketing MAP · Panel',
  description: 'Sistema de captación y gestión de clientes con IA',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Marketing MAP',
  },
  themeColor: '#4f46e5',
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
      <head>
        <link rel="icon" href="/map-logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/map-logo.png" />
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js');
            });
          }
        ` }} />
      </head>
      <body>
        {email ? (
          <div className="app">
            <aside className="sidebar">
              <div className="brand" style={{ padding: '16px 12px 12px', display: 'block' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/map-logo.png"
                  alt="MAP Consultoría & Asesoría Marketing"
                  style={{ width: '100%', maxWidth: 160, borderRadius: 8, display: 'block', margin: '0 auto' }}
                />
              </div>
              <Nav />
              <div className="sidebar-foot" style={{ fontSize: 10, lineHeight: 1.5, padding: '12px 14px', textAlign: 'center' }}>
                <div style={{ marginBottom: 3 }}>© 2026 Marketing MAP</div>
                <div style={{ color: 'var(--muted)', fontSize: 9 }}>Desarrollado por</div>
                <div style={{ fontWeight: 600, fontSize: 10 }}>Marco Antonio Posligua San Martín</div>
              </div>
            </aside>

            <div className="content">
              <header className="topbar">
                <span className="title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/map-logo.png" alt="MAP" style={{ height: 32, borderRadius: 4 }} />
                  <span>Panel de control</span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="status-pill"><span className="dot" /> Sistema activo</span>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {displayName}{role ? ` · ${role}` : ''}
                  </span>
                  {/* Guía de configuración — botón inline en la topbar */}
                  <GuidePanel />
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
