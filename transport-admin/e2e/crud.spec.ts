import { test, expect } from '@playwright/test';
import {
  uid, digits, field, selectFirstOption,
  submitCreate, submitEdit, expectDetail, expectInList, deleteFromDetail,
} from './helpers';

// Each test walks one entity through the admin UI: create → find in the list → detail → edit →
// delete. Rows are named "E2E …" with a unique suffix and are deleted by the test itself.

test('Província: criar, listar, ver, editar, eliminar', async ({ page }) => {
  const id = uid();
  await page.goto('/provincias/novo');
  await page.getByPlaceholder('Ex: Maputo').fill(`E2E Província ${id}`);
  await page.getByPlaceholder('Ex: MPT').fill(`E${id.slice(-6)}`);
  await page.getByPlaceholder('-25.9655,32.5892').fill('-25.9655,32.5892');
  const pid = await submitCreate(page, '/api/provincias', 'Criar Província');

  await expectInList(page, '/provincias', `E2E Província ${id}`);
  await expectDetail(page, `/provincias/${pid}`, `E2E Província ${id}`);

  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByPlaceholder('Ex: Maputo').fill(`E2E Província ${id} editada`);
  await submitEdit(page, `/api/provincias/${pid}`, 'Salvar Alterações');
  await expectDetail(page, `/provincias/${pid}`, `E2E Província ${id} editada`);

  await deleteFromDetail(page, `/provincias/${pid}`, `/api/provincias/${pid}`);
});

test('Município: criar, listar, ver, editar, eliminar', async ({ page }) => {
  const id = uid();
  await page.goto('/municipios/novo');
  await page.getByPlaceholder('Ex: KaMpfumo').fill(`E2E Município ${id}`);
  await page.getByPlaceholder('Ex: KMPF').fill(`M${id.slice(-6)}`);
  await selectFirstOption(page, 'Província');
  await page.getByPlaceholder('Ex: Av. Julius Nyerere, 123').fill('Av. de Teste, 1');
  await page.getByPlaceholder('840000000').fill(`84${digits(7)}`);
  const mid = await submitCreate(page, '/api/municipios', 'Criar Município');

  await expectInList(page, '/municipios', `E2E Município ${id}`);
  await expectDetail(page, `/municipios/${mid}`, `E2E Município ${id}`);

  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByPlaceholder('Ex: KaMpfumo').fill(`E2E Município ${id} editado`);
  await submitEdit(page, `/api/municipios/${mid}`, 'Salvar Alterações');
  await expectDetail(page, `/municipios/${mid}`, `E2E Município ${id} editado`);

  await deleteFromDetail(page, `/municipios/${mid}`, `/api/municipios/${mid}`);
});

test('Paragem: criar, listar, ver, editar, eliminar', async ({ page }) => {
  const id = uid();
  await page.goto('/paragens/novo');
  await page.getByPlaceholder('Ex: Praça dos Heróis').fill(`E2E Paragem ${id}`);
  await page.getByPlaceholder('Ex: PAR-001').fill(`PAR-E2E-${id}`);
  // Latitude and longitude are read-only: they are set by clicking the map, and the stop must
  // belong to a route within 100 m of the click. The map opens centred on [32.83, -26.85] at
  // zoom 12, so click on the route point nearest that centre.
  const canvas = page.locator('.maplibregl-canvas').first();
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  const vias = (await (await page.request.get('/api/vias?limit=1000')).json()).data as { geoLocationPath: string }[];
  const center = { lng: 32.83, lat: -26.85 }, zoom = 12;
  const world = 512 * 2 ** zoom; // MapLibre uses 512 px tiles
  const project = (lng: number, lat: number) => ({
    x: ((lng + 180) / 360) * world,
    y: ((180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) * world) / 360,
  });
  const c = project(center.lng, center.lat);
  let target: { x: number; y: number; px: { x: number; y: number } } | null = null;
  let best = Infinity;
  for (const v of vias) {
    for (const pair of (v.geoLocationPath || '').split(';')) {
      const [lng, lat] = pair.split(',').map(Number);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      const p = project(lng, lat);
      const x = box.width / 2 + (p.x - c.x), y = box.height / 2 + (p.y - c.y);
      const d = Math.hypot(x - box.width / 2, y - box.height / 2);
      if (x > 40 && y > 40 && x < box.width - 40 && y < box.height - 40 && d < best) { best = d; target = { x, y, px: p }; }
    }
  }
  expect(target, 'no route point inside the initial map view').toBeTruthy();
  await page.waitForTimeout(2000); // map style and click handler
  // The map is tilted (pitch 60), so the flat projection is only a first guess: click, read
  // where the click landed, and refine per axis with the secant method.
  const lat = page.getByPlaceholder('-25.9655'), lng = page.getByPlaceholder('32.5892');
  const clickAt = async (pos: { x: number; y: number }) => {
    await canvas.click({ position: pos });
    await expect(lat).not.toHaveValue('');
    await page.waitForTimeout(300); // let React show the new coordinates
    return project(Number(await lng.inputValue()), Number(await lat.inputValue()));
  };
  const want = target!.px;
  let prev = { x: target!.x, y: target!.y };
  let prevLanded = await clickAt(prev);
  let pos = { x: prev.x + (want.x - prevLanded.x), y: prev.y + (want.y - prevLanded.y) };
  for (let i = 0; i < 6; i++) {
    const landed = await clickAt(pos);
    if (Math.hypot(want.x - landed.x, want.y - landed.y) < 2) break; // < ~35 m at zoom 12
    const step = (axis: 'x' | 'y') => {
      const moved = landed[axis] - prevLanded[axis];
      const scale = Math.abs(moved) > 0.01 ? (pos[axis] - prev[axis]) / moved : 1;
      return pos[axis] + scale * (want[axis] - landed[axis]);
    };
    const next = { x: step('x'), y: step('y') };
    prev = pos; prevLanded = landed; pos = next;
  }
  await page.getByRole('button', { name: 'Selecionar Todas' }).click();
  const sid = await submitCreate(page, '/api/paragens', 'Criar Paragem');

  await expectInList(page, '/paragens', `E2E Paragem ${id}`);
  await expectDetail(page, `/paragens/${sid}`, `E2E Paragem ${id}`);

  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await field(page, 'Nome da Paragem').fill(`E2E Paragem ${id} editada`);
  await submitEdit(page, `/api/paragens/${sid}`, 'Guardar Alterações');
  await expectDetail(page, `/paragens/${sid}`, `E2E Paragem ${id} editada`);

  await deleteFromDetail(page, `/paragens/${sid}`, `/api/paragens/${sid}`);
});

test('Via: criar (desenhada no mapa), listar, ver, editar, eliminar', async ({ page }) => {
  // The form asks the public OSRM server for a road-following path; answer it locally so the
  // test does not depend on that service.
  await page.route('https://router.project-osrm.org/**', (route) =>
    route.fulfill({
      json: {
        code: 'Ok',
        routes: [{ geometry: { type: 'LineString', coordinates: [[32.58, -25.96], [32.585, -25.962], [32.59, -25.965]] } }],
      },
    }),
  );
  const id = uid();
  await page.goto('/vias/novo');
  await page.getByPlaceholder('Ex: Via Principal Centro').fill(`E2E Via ${id}`);
  await page.getByPlaceholder('Ex: VP-001').fill(`VP-E2E-${id}`);
  await selectFirstOption(page, 'Município');
  await page.getByPlaceholder('Ex: Terminal Central').fill('Terminal E2E A');
  await page.getByPlaceholder('Ex: Terminal Norte').fill('Terminal E2E B');

  const canvas = page.locator('.maplibregl-canvas').first();
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  await page.waitForTimeout(2000); // map style and click handler
  await canvas.click({ position: { x: box.width * 0.4, y: box.height * 0.5 } });
  await canvas.click({ position: { x: box.width * 0.6, y: box.height * 0.5 } });
  const counts = page.getByTestId('route-counts');
  await expect(counts).toContainText('Pontos na rota: 2');

  // A wrong click can be undone (button or Ctrl+Z) and redone, one step at a time
  await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.3 } });
  await expect(counts).toContainText('Pontos na rota: 3');
  await page.getByRole('button', { name: /Desfazer/ }).click();
  await expect(counts).toContainText('Pontos na rota: 2');
  await page.getByRole('button', { name: /Refazer/ }).click();
  await expect(counts).toContainText('Pontos na rota: 3');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()); // Ctrl+Z in a field undoes typing
  await page.keyboard.press('Control+z');
  await expect(counts).toContainText('Pontos na rota: 2');
  await expect(page.getByTestId('route-point')).toHaveCount(2);
  await expect(page.getByTestId('route-status')).toContainText('Percurso pelas estradas');

  const vid = await submitCreate(page, '/api/vias', 'Criar Via');

  await expectInList(page, '/vias', `E2E Via ${id}`);
  await expectDetail(page, `/vias/${vid}`, `E2E Via ${id}`);

  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await field(page, 'Nome da Via').fill(`E2E Via ${id} editada`);
  await submitEdit(page, `/api/vias/${vid}`, 'Guardar');
  await expectDetail(page, `/vias/${vid}`, `E2E Via ${id} editada`);

  await deleteFromDetail(page, `/vias/${vid}`, `/api/vias/${vid}`);
});

test('Proprietário: criar, listar, ver, editar, eliminar', async ({ page }) => {
  const id = uid();
  await page.goto('/proprietarios/novo');
  await page.getByPlaceholder('Ex: Transportes Rápidos Lda').fill(`E2E Proprietário ${id}`);
  await page.getByPlaceholder('Ex: 100000000006F').fill(`${digits(12)}E`);
  await page.getByPlaceholder('Ex: Moçambicana').fill('Moçambicana');
  await field(page, 'Data de Início de Operações').fill('2020-01-15');
  await page.getByPlaceholder('Ex: Av. 24 de Julho, 789, Maputo').fill('Av. de Teste, 2, Maputo');
  await field(page, 'Telefone *').fill(`84${digits(7)}`);
  const oid = await submitCreate(page, '/api/proprietarios', 'Criar Proprietário');

  await expectInList(page, '/proprietarios', `E2E Proprietário ${id}`);
  await expectDetail(page, `/proprietarios/${oid}`, `E2E Proprietário ${id}`);

  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await field(page, 'Nome da Empresa').fill(`E2E Proprietário ${id} editado`);
  await submitEdit(page, `/api/proprietarios/${oid}`, 'Guardar Alterações');
  await expectDetail(page, `/proprietarios/${oid}`, `E2E Proprietário ${id} editado`);

  await deleteFromDetail(page, `/proprietarios/${oid}`, `/api/proprietarios/${oid}`);
});

test('Motorista: criar, listar, ver, editar, eliminar', async ({ page }) => {
  const id = uid();
  const phone = `86${digits(7)}`;
  await page.goto('/motoristas/novo');
  await page.getByPlaceholder('Ex: Abasi Muthisse').fill(`E2E Motorista ${id}`);
  await field(page, 'Data de Nascimento').fill('1990-05-20');
  await page.getByPlaceholder('Ex: Moçambicana').fill('Moçambicana');
  await page.getByPlaceholder('Ex: Av. Muthisse, 162, Maputo').fill('Av. de Teste, 3, Maputo');
  await page.getByPlaceholder('Ex: 110200000062K').fill(`${digits(12)}K`);
  await field(page, 'Data de Emissão', 0).fill('2022-01-10');
  await field(page, 'Data de Validade', 0).fill('2032-01-10');
  await page.getByPlaceholder('Ex: CC-2022-000063').fill(`CC-E2E-${id}`);
  await field(page, 'Categoria').selectOption({ index: 3 });
  await field(page, 'Data de Emissão', 1).fill('2022-02-10');
  await field(page, 'Data de Validade', 1).fill('2032-02-10');
  await page.getByPlaceholder('861621434').fill(phone);
  await page.getByPlaceholder('Ex: abasi.muthisse@transport.co.mz').fill(`e2e.${id.toLowerCase()}@local.test`);
  await page.getByPlaceholder('Ex: Isabel Nhaca (Familiar)').fill('Contacto E2E');
  await page.getByPlaceholder('845622062').fill(`84${digits(7)}`);
  await page.getByPlaceholder('Ex: 5').fill('5');
  await page.getByPlaceholder('Digite a senha para o driver login').fill(`e2e-driver-${id}`);
  const did = await submitCreate(page, '/api/motoristas', 'Criar Motorista');

  await expectInList(page, '/motoristas', `E2E Motorista ${id}`);
  await expectDetail(page, `/motoristas/${did}`, `E2E Motorista ${id}`);

  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await field(page, 'Nome Completo').fill(`E2E Motorista ${id} editado`);
  await submitEdit(page, `/api/motoristas/${did}`, 'Guardar Alterações');
  await expectDetail(page, `/motoristas/${did}`, `E2E Motorista ${id} editado`);

  await deleteFromDetail(page, `/motoristas/${did}`, `/api/motoristas/${did}`);
});

test('Transporte: criar, listar, ver, editar, eliminar', async ({ page }) => {
  const id = uid();
  const plate = `E2E-${id.slice(-4)}-MZ`;
  await page.goto('/transportes/novo');
  await page.getByPlaceholder('Ex: AAA-123-MZ').fill(plate);
  await page.getByPlaceholder('Ex: Hiace').fill('Hiace');
  await page.getByPlaceholder('Ex: Toyota').fill('Toyota');
  await page.getByPlaceholder('Ex: Branco').fill('Branco');
  await page.getByPlaceholder('2020').fill('2021');
  await page.getByPlaceholder('50').fill('30');
  await selectFirstOption(page, 'Via');
  const tid = await submitCreate(page, '/api/transportes', 'Criar Transporte');

  await expectInList(page, '/transportes', plate);
  await expectDetail(page, `/transportes/${tid}`, plate);

  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await field(page, 'Matrícula').fill(`${plate}X`);
  await submitEdit(page, `/api/transportes/${tid}`, 'Guardar Alterações');
  await expectDetail(page, `/transportes/${tid}`, `${plate}X`);

  await deleteFromDetail(page, `/transportes/${tid}`, `/api/transportes/${tid}`);
});

test('Utente: criar, listar, ver, editar, eliminar', async ({ page }) => {
  const id = uid();
  await page.goto('/utentes/criar');
  await page.getByPlaceholder('Nome completo do utente').fill(`E2E Utente ${id}`);
  await page.getByPlaceholder('email@exemplo.com').fill(`utente.${id.toLowerCase()}@local.test`);
  await page.getByPlaceholder('+258 XX XXX XXXX').fill(`+25884${digits(7)}`);
  await page.getByPlaceholder('Senha do utente').fill(`e2e-utente-${id}`);
  await page.getByPlaceholder('MISSION-XXXXX').fill(`MISSION-E2E-${id}`);
  const uidCreated = await submitCreate(page, '/api/utentes', 'Criar Utente');

  await expectInList(page, '/utentes', `E2E Utente ${id}`);
  await expectDetail(page, `/utentes/${uidCreated}`, `E2E Utente ${id}`);

  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByPlaceholder('Nome completo do utente').fill(`E2E Utente ${id} editado`);
  await submitEdit(page, `/api/utentes/${uidCreated}`, 'Salvar Alterações');
  await expectDetail(page, `/utentes/${uidCreated}`, `E2E Utente ${id} editado`);

  await deleteFromDetail(page, `/utentes/${uidCreated}`, `/api/utentes/${uidCreated}`);
});

test('Administrador: criar, listar, ver, editar, eliminar', async ({ page }) => {
  const id = uid();
  const senha = `e2e-admin-${id}`;
  await page.goto('/administradores/criar');
  await page.getByPlaceholder('Nome completo do administrador').fill(`E2E Administrador ${id}`);
  await page.getByPlaceholder('email@exemplo.com').fill(`admin.${id.toLowerCase()}@local.test`);
  await page.getByPlaceholder('Mínimo 6 caracteres').fill(senha);
  await page.getByPlaceholder('Repita a senha').fill(senha);
  const aid = await submitCreate(page, '/api/administradores', 'Criar Administrador');

  await expectInList(page, '/administradores', `E2E Administrador ${id}`);
  await expectDetail(page, `/administradores/${aid}`, `E2E Administrador ${id}`);

  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByPlaceholder('Nome completo do administrador').fill(`E2E Administrador ${id} editado`);
  await submitEdit(page, `/api/administradores/${aid}`, 'Guardar Alterações');
  await expectDetail(page, `/administradores/${aid}`, `E2E Administrador ${id} editado`);

  await deleteFromDetail(page, `/administradores/${aid}`, `/api/administradores/${aid}`);
});

test('API sem sessão responde 401', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  for (const api of ['/api/provincias', '/api/vias', '/api/motoristas', '/api/administradores']) {
    const r = await context.request.get(api);
    expect(r.status(), api).toBe(401);
  }
  await context.close();
});
