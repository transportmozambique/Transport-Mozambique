import { test, expect } from '@playwright/test';

// As paragens das vias aparecem nos mapas: o da página de um transporte (as da sua via) e o do início (as de cada via activa).
test('Mapas: paragens da via do transporte e das vias activas no início', async ({ page }) => {
  const list = await (await page.request.get('/api/transportes?limit=30')).json();
  const rows: { id: string }[] = list.data ?? list.transportes ?? list;
  let id = '';
  let stops: { nome: string; isTerminal: boolean }[] = [];
  for (const row of rows) {
    const detail = await (await page.request.get(`/api/transportes/${row.id}`)).json();
    if (detail.stops?.length) {
      id = row.id;
      stops = detail.stops;
      break;
    }
  }
  expect(id, 'um transporte com uma via com paragens').not.toBe('');

  // Página do transporte: um marcador por paragem, mais o do autocarro; o nome da paragem ao clicar
  await page.goto(`/transportes/${id}`);
  const markers = page.locator('.maplibregl-marker');
  await expect(markers).toHaveCount(stops.length + 1, { timeout: 30_000 });
  // Os marcadores das paragens vêm pela ordem da via, antes do do autocarro; uma a meio fica dentro do mapa
  const mid = Math.floor(stops.length / 2);
  await markers.nth(mid).dispatchEvent('click');
  await expect(page.locator('.maplibregl-popup')).toContainText(stops[mid].nome);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/transporte.png` });

  // Início: as vias activas trazem as suas paragens, e o mapa desenha uma camada de paragens por via
  const stats = await (await page.request.get('/api/dashboard/stats')).json();
  const vias: { id: string; stops?: unknown[] }[] = stats.viasData ?? [];
  expect(vias.length).toBeGreaterThan(0);
  for (const via of vias) expect(via.stops?.length ?? 0).toBeGreaterThan(0);

  await page.goto('/dashboard');
  const canvas = page.locator('.maplibregl-canvas');
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(4000);
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `${process.env.E2E_SHOTS}/inicio.png` });
});
