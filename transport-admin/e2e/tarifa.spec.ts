import { test, expect } from '@playwright/test';

// The fare rule is edited on its own page; the values are checked and the change is visible at once
test('Tarifa: ver, pré-visualizar, recusar valor fora do limite, guardar', async ({ page }) => {
  const original = await (await page.request.get('/api/tarifa')).json();
  expect(original).toHaveProperty('precoPorKm');
  const restore = () =>
    page.request.put('/api/tarifa', {
      data: {
        tarifaMinima: original.tarifaMinima,
        precoPorKm: original.precoPorKm,
        velocidadeViagemKmh: original.velocidadeViagemKmh,
        velocidadeChegadaKmh: original.velocidadeChegadaKmh,
        fatorEstrada: original.fatorEstrada,
      },
    });

  try {
    await page.goto('/tarifa');
    await expect(page.getByRole('heading', { name: 'Tarifa', exact: true })).toBeVisible();
    const minima = page.getByRole('spinbutton', { name: /Tarifa mínima/ });
    const porKm = page.getByRole('spinbutton', { name: /Preço por km/ });
    await expect(porKm).toHaveValue(String(original.precoPorKm));

    // The preview follows the values typed, before saving
    const newPerKm = original.precoPorKm + 2;
    await porKm.fill(String(newPerKm));
    const fare5 = Math.max(original.tarifaMinima, Math.ceil(5 * newPerKm));
    await expect(page.getByText(`${fare5} MT`, { exact: true })).toBeVisible();

    // Out of range: refused with the allowed range, nothing saved
    await minima.fill('5000');
    await page.getByRole('button', { name: 'Guardar tarifa' }).click();
    await expect(page.getByText('Tarifa mínima: indique um número inteiro entre 0 e 1000')).toBeVisible();
    expect((await (await page.request.get('/api/tarifa')).json()).precoPorKm).toBe(original.precoPorKm);

    await minima.fill(String(original.tarifaMinima));
    await page.getByRole('button', { name: 'Guardar tarifa' }).click();
    await expect(page.getByText(/Tarifa guardada/)).toBeVisible();
    expect((await (await page.request.get('/api/tarifa')).json()).precoPorKm).toBe(newPerKm);
  } finally {
    expect((await restore()).ok()).toBe(true);
  }
});
