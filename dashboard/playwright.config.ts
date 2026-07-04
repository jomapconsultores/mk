import { defineConfig, devices } from '@playwright/test';

// Secreto fijo para firmar cookies de sesión en los tests (ver e2e/session.ts).
// Solo aplica al servidor que Playwright arranca (CI o sin dev server ya corriendo);
// si reusas un `npm run dev` local con su propio SESSION_SECRET, este valor no aplica.
export const E2E_SESSION_SECRET = 'e2e-test-secret';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // Un solo dev server compartido compilando rutas on-demand: correr en serie evita que
  // el primer hit a cada ruta compita por CPU y exceda el timeout de cada test.
  workers: 1,
  use: {
    baseURL: 'http://localhost:3001',
    headless: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001/login',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // Valores dummy: el layout autenticado consulta Supabase para el nombre/rol de forma
    // opcional (ver src/app/layout.tsx) y tolera que la consulta falle, así que evitamos
    // depender de credenciales reales para correr los tests.
    env: {
      SESSION_SECRET: E2E_SESSION_SECRET,
      SUPABASE_URL: 'https://e2e-test.supabase.co',
      SUPABASE_SERVICE_KEY: 'e2e-test-key',
    },
  },
});
