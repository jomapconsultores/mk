import { test, expect } from '@playwright/test';
import { E2E_SESSION_SECRET } from '../playwright.config';
import { SESSION_COOKIE, signSession } from './session';

const MERCADO_MOCK = {
  cliente_ideal: 'Negocios y profesionales independientes de Cuenca',
  industrias: ['Restaurantes', 'Clínicas'],
  queries_juridicas: ['restaurantes y cafeterías', 'clínicas y consultorios'],
  queries_naturales: ['abogados independientes', 'contadores autónomos'],
  perfil_natural: 'Profesionales que facturan a nombre propio',
  por_que_lo_necesitan: 'Necesitan atraer más clientes',
};

test.beforeEach(async ({ context, baseURL }) => {
  const token = await signSession('e2e@test.local', 'admin', process.env.SESSION_SECRET ?? E2E_SESSION_SECRET);
  await context.addCookies([{ name: SESSION_COOKIE, value: token, url: baseURL }]);
});

test('la búsqueda de mercado muestra los segmentos jurídicas/naturales y sus totales', async ({ page }) => {
  await page.route('**/captacion/buscar-mercado', async (route) => {
    const body = route.request().postDataJSON();
    if (body.inferir) {
      await route.fulfill({ json: {
        ok: true, encontrados: 10, guardados: 6, guardados_juridicas: 4, guardados_naturales: 2,
        sourceId: 'src-1', mercado: MERCADO_MOCK,
      }});
    } else {
      // Verifica que el payload nuevo (queries_juridicas/naturales) sea el que envía la página.
      expect(body.queries_juridicas).toEqual(MERCADO_MOCK.queries_juridicas);
      expect(body.queries_naturales).toEqual(MERCADO_MOCK.queries_naturales);
      await route.fulfill({ json: { ok: true, encontrados: 3, guardados: 2, guardados_juridicas: 1, guardados_naturales: 1, sourceId: 'src-2' } });
    }
  });

  await page.goto('/captacion');
  await page.getByPlaceholder(/Software de gestión tributaria/).fill('Servicio de contabilidad');
  await page.getByRole('button', { name: /Buscar mercado/ }).click();

  await expect(page.getByText(MERCADO_MOCK.cliente_ideal)).toBeVisible();
  await expect(page.getByText('restaurantes y cafeterías')).toBeVisible();
  await expect(page.getByText('abogados independientes')).toBeVisible();

  await expect(page.getByText('4 jurídicas')).toBeVisible();
  await expect(page.getByText('2 naturales')).toBeVisible();

  // Detenemos antes de que siga iterando por las 10 ciudades.
  await page.getByRole('button', { name: /Detener/ }).click();
});
