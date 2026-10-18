import { test, expect } from '@playwright/test';

// Os motoristas entram com um PIN gerado pelo administrador; o hash nunca sai do servidor.
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

  // Depois de recarregar o PIN já não aparece, só que existe um
  await page.reload();
  await expect(card).toContainText('PIN definido');
  await expect(card.getByTestId('driver-pin')).toHaveCount(0);
});
