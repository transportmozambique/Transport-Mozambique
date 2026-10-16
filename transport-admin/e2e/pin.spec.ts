import { test, expect } from '@playwright/test';

// Drivers sign in with a PIN the admin generates; the hash never leaves the server.
test('Motorista: gerar PIN de acesso (mostrado uma vez)', async ({ page }) => {
  const list = await (await page.request.get('/api/motoristas?limit=1')).json();
  const m = list.data[0];
  expect(m).not.toHaveProperty('password');
  const detail = await (await page.request.get(`/api/motoristas/${m.id}`)).json();
  expect(detail).not.toHaveProperty('password');

  await page.goto(`/motoristas/${m.id}`);
  const card = page.getByTestId('pin-card');
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: /Gerar (novo )?PIN/ }).click();
  await expect(card.getByTestId('driver-pin')).toHaveText(/^\d{6}$/);
  await expect(card).toContainText('PIN definido');

  // After a reload the PIN is no longer shown, only that one exists
  await page.reload();
  await expect(card).toContainText('PIN definido');
  await expect(card.getByTestId('driver-pin')).toHaveCount(0);
});
