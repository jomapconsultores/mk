import { test, expect } from '@playwright/test';

test('el ojito muestra y oculta la contraseña', async ({ page }) => {
  await page.goto('/login');

  const input = page.locator('input[name="password"]');
  const toggle = page.getByRole('button', { name: /contraseña/ });

  // Escribimos una clave para comprobar el efecto.
  await input.fill('MiClave123');

  // Estado inicial: oculta.
  await expect(input).toHaveAttribute('type', 'password');
  await expect(toggle).toHaveAttribute('aria-label', 'Mostrar contraseña');

  // Primer click: se descubre.
  await toggle.click();
  await expect(input).toHaveAttribute('type', 'text');
  await expect(toggle).toHaveAttribute('aria-label', 'Ocultar contraseña');
  await expect(input).toHaveValue('MiClave123');

  // Segundo click: se oculta de nuevo.
  await toggle.click();
  await expect(input).toHaveAttribute('type', 'password');
  await expect(toggle).toHaveAttribute('aria-label', 'Mostrar contraseña');
});
