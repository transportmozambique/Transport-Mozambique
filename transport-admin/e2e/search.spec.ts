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

// A phone is found by its digits, whatever spacing it was stored with
test('Pesquisa por telefone: os dígitos encontram o motorista', async ({ page }) => {
  const motoristas = await (await page.request.get('/api/motoristas?limit=1')).json();
  const motorista = motoristas.data[0];
  const phoneDigits = motorista.telefone.replace(/\D/g, '').replace(/^258/, '');
  const part = phoneDigits.slice(-7);
  const spaced = `${part.slice(0, 2)} ${part.slice(2, 5)} ${part.slice(5)}`;

  for (const query of [part, spaced, `+258${phoneDigits}`]) {
    const found = await (await page.request.get(`/api/motoristas?limit=50&search=${encodeURIComponent(query)}`)).json();
    expect(found.data.map((m: { id: string }) => m.id)).toContain(motorista.id);
  }

  await page.goto('/dashboard');
  await page.getByLabel('Pesquisar transportes, vias e motoristas').fill(spaced);
  await expect(
    page.getByRole('group', { name: 'Motoristas' }).getByRole('button', { name: new RegExp(escapeRegExp(motorista.nome)) })
  ).toBeVisible();
});
