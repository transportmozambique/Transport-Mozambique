import { test, expect } from '@playwright/test';

// The vehicle page shows where the bus is (real GPS or timetable) and manages its GPS device code.
test('Transporte: posição em tempo real e código do dispositivo GPS', async ({ page }) => {
  const list = await (await page.request.get('/api/transportes?limit=1')).json();
  const id: string = (list.data ?? list.transportes ?? list)[0].id;
  const detail = await (await page.request.get(`/api/transportes/${id}`)).json();
  const stopNames: string[] = (detail.via?.paragens ?? []).map((vp: { paragem: { nome: string } }) => vp.paragem.nome);

  await page.goto(`/transportes/${id}`);
  const card = page.getByTestId('gps-card');
  await expect(card).toBeVisible();

  // Position footer: real values from the route, not the old placeholders ("45 km/h", "Costa do Sol")
  const status = page.getByTestId('position-status');
  await expect(status).toContainText(/GPS real|estimado pelo horário/);
  const footer = page.getByTestId('position-footer');
  await expect(footer).toContainText(/\d+ km\/h|—/);
  await expect(footer).toContainText(/\d+ min|às \d\d:\d\d|—/);
  const nextStop = (await footer.locator('p').nth(3).innerText()).trim();
  expect(['—', ...stopNames]).toContain(nextStop);

  // Create a device code: shown once, with the Traccar Client settings
  await card.getByRole('button', { name: /Gerar (novo )?código/ }).click();
  const code = card.getByTestId('gps-code');
  await expect(code).toHaveText(/^[A-Za-z0-9_-]{20}$/);
  await expect(card).toContainText('URL do servidor');
  await expect(card).toContainText(/Sem sinal recente|GPS ativo/);

  // Revoke it (two clicks: no browser dialog)
  await card.getByRole('button', { name: 'Revogar dispositivo' }).click();
  await card.getByRole('button', { name: 'Confirmar revogação' }).click();
  await expect(card).toContainText('Não configurado');
  await expect(code).toHaveCount(0);
});
