import { test, expect } from '@playwright/test';

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The search box in the header finds vehicles, routes and drivers and opens their pages
test('Pesquisa no cabeçalho: encontra transporte, via e motorista', async ({ page }) => {
  const [transportes, vias, motoristas] = await Promise.all([
    page.request.get('/api/transportes?limit=1').then((r) => r.json()),
    page.request.get('/api/vias?limit=1').then((r) => r.json()),
    page.request.get('/api/motoristas?limit=1').then((r) => r.json()),
  ]);
  const transporte = transportes.data[0];
  const via = vias.data[0];
  const motorista = motoristas.data[0];

  await page.goto('/dashboard');
  const search = page.getByLabel('Pesquisar transportes, vias e motoristas');
  const group = (label: string) => page.getByRole('group', { name: label });

  // Lower case still matches (the search ignores case)
  await search.fill(transporte.matricula.toLowerCase());
  await group('Transportes').getByRole('button', { name: new RegExp(escapeRegExp(transporte.matricula)) }).first().click();
  await expect(page).toHaveURL(new RegExp(`/transportes/${transporte.id}$`));

  await search.fill(via.nome);
  await group('Vias').getByRole('button', { name: new RegExp(escapeRegExp(via.nome)) }).first().click();
  await expect(page).toHaveURL(new RegExp(`/vias/${via.id}$`));

  // Enter opens the first result
  await search.fill(motorista.nome);
  await expect(group('Motoristas')).toBeVisible();
  await search.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/motoristas/${motorista.id}$`));

  await search.fill('zzzz-nada-assim');
  await expect(page.getByText('Sem resultados para "zzzz-nada-assim"')).toBeVisible();
});
