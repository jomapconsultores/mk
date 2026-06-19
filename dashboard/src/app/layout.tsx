import './globals.css';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import Nav from './Nav';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata = {
  title: 'marketing-map · Panel',
  description: 'Sistema de captación y gestión de clientes con IA',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body>
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
              <span className="status-pill"><span className="dot" /> Sistema activo</span>
            </header>
            <main className="main">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
