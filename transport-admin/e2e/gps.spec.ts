import { test, expect } from '@playwright/test';

// A página do veículo mostra onde está o autocarro (GPS real ou horário) e gere o código do seu dispositivo GPS.
test('Transporte: posição em tempo real e código do dispositivo GPS', async ({ page }) => {
  const list = await (await page.request.get('/api/transportes?limit=1')).json();
  const id: string = (list.data ?? list.transportes ?? list)[0].id;
  const detail = await (await page.request.get(`/api/transportes/${id}`)).json();
  const stopNames: string[] = (detail.via?.paragens ?? []).map((vp: { paragem: { nome: string } }) => vp.paragem.nome);

  await page.goto(`/transportes/${id}`);
  const card = page.getByTestId('gps-card');
  await expect(card).toBeVisible();

  // Rodapé da posição: valores reais da via, não os antigos de exemplo ("45 km/h", "Costa do Sol")
  const status = page.getByTestId('position-status');
  await expect(status).toContainText(/GPS real|estimado pela viagem|onde parou/);
  const footer = page.getByTestId('position-footer');
  await expect(footer).toContainText(/\d+ km\/h|—/);
  await expect(footer).toContainText(/\d+ min|às \d\d:\d\d|—/);
  const nextStop = (await footer.locator('p').nth(3).innerText()).trim();
  expect(['—', ...stopNames]).toContain(nextStop);

  // Os números vêm da viagem em curso do motorista; nada de combustível, passageiros ou manutenção inventados
  await expect(page.getByTestId('operacao-cards')).toContainText('Quilómetros na Viagem');
  await expect(page.getByTestId('passagens')).toContainText(stopNames[0] ?? '');
  for (const fake of ['Consumo de Combustível', 'Passageiros Transportados', '45,230 km', 'Manutenção', 'vs ontem']) {
    await expect(page.getByText(fake)).toHaveCount(0);
  }

  // Criar um código de dispositivo: mostrado uma vez, com a configuração do Traccar Client
  await card.getByRole('button', { name: /Gerar (novo )?código/ }).click();
  const code = card.getByTestId('gps-code');
  await expect(code).toHaveText(/^[A-Za-z0-9_-]{20}$/);
  await expect(card).toContainText('URL do servidor');
  await expect(card).toContainText(/Sem sinal recente|GPS ativo/);

  // Revogá-lo (dois cliques: sem diálogo do navegador)
  await card.getByRole('button', { name: 'Revogar dispositivo' }).click();
  await card.getByRole('button', { name: 'Confirmar revogação' }).click();
  await expect(card).toContainText('Não configurado');
  await expect(code).toHaveCount(0);
});
