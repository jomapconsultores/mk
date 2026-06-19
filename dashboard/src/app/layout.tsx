import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Marketing MAP — Panel',
  description: 'Panel de control del sistema de marketing automatizado',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <div className="layout">
          <aside className="sidebar">
            <h1>marketing-map</h1>
            <span className="tag">Panel de control</span>
            <nav className="nav">
              <a href="/">📊 Tablero</a>
              <a href="/leads">👥 Clientes</a>
              <a href="/products">📦 Productos</a>
              <a href="/sequences">🔁 Seguimientos</a>
            </nav>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
