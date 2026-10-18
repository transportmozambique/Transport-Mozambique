import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import {
  uid, digits, field, selectFirstOption, E2E_DATABASE_URL,
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
  // Each click leaves the new stop's marker where it landed, right where the next, refined click
  // goes: let clicks through the markers to the map
  await page.addStyleTag({ content: '.maplibregl-marker { pointer-events: none; }' });
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

test('Paragem com alerta de passageiro: eliminar remove também o alerta', async ({ page }) => {
  const id = uid();
  const via = (await (await page.request.get('/api/vias?limit=1')).json()).data[0];
  const created = await page.request.post('/api/paragens', {
    data: { nome: `E2E Paragem ${id}`, codigo: `PAR-E2E-${id}`, geoLocation: '-25.9692,32.5732', viaIds: [via.id] },
  });
  expect(created.ok()).toBeTruthy();
  const pid = (await created.json()).id as string;
  const utente = await (await page.request.post('/api/utentes', {
    data: { nome: `E2E Utente ${id}`, email: `e2e.${id.toLowerCase()}@local.test`, telefone: `+25886${digits(7)}`, senha: 'e2e-utente-pass', mISSION: `E2E-${id}` },
  })).json();

  // Arrival alerts are created by the passenger app; insert one directly
  const prisma = new PrismaClient({ datasources: { db: { url: E2E_DATABASE_URL } } });
  try {
    await prisma.mISSION.create({
      data: {
        mISSIONUtente: `E2E-${id}`, codigoParagem: `PAR-E2E-${id}`, geoLocationUtente: '',
        geoLocationParagem: '-25.9692,32.5732', utenteId: utente.id, paragemId: pid,
      },
    });

    const deleted = await page.request.delete(`/api/paragens/${pid}`);
    expect(deleted.status()).toBe(200);
    expect((await deleted.json()).alertasRemovidos).toBe(1);
    expect(await prisma.mISSION.count({ where: { paragemId: pid } })).toBe(0);
  } finally {
    await prisma.mISSION.deleteMany({ where: { utenteId: utente.id } });
    await prisma.$disconnect();
    await page.request.delete(`/api/utentes/${utente.id}`);
  }
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
  await page.addStyleTag({ content: '.maplibregl-marker { pointer-events: none; }' }); // clicks reach the map, not a stop
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

  // Redrawing the path: a straight fallback cannot be saved, a road path replaces the old one.
  // Handlers registered later run first, so this one now answers the router.
  let routerUp = false;
  await page.route('https://router.project-osrm.org/**', (route) =>
    routerUp
      ? route.fulfill({
          json: {
            code: 'Ok',
            routes: [{ geometry: { type: 'LineString', coordinates: [[32.57, -25.95], [32.575, -25.955], [32.6, -25.97]] } }],
          },
        })
      : route.abort(),
  );
  await page.getByRole('button', { name: 'Redesenhar percurso' }).click();
  await expect(page).toHaveURL(new RegExp(`/vias/${vid}/percurso$`));
  await expect(page.getByText(`VP-E2E-${id}`)).toBeVisible();
  const map = page.locator('.maplibregl-canvas').first();
  await expect(map).toBeVisible();
  const mapBox = (await map.boundingBox())!;
  await page.waitForTimeout(2000); // map style and click handler
  await page.addStyleTag({ content: '.maplibregl-marker { pointer-events: none; }' });
  await map.click({ position: { x: mapBox.width * 0.3, y: mapBox.height * 0.5 } });
  await map.click({ position: { x: mapBox.width * 0.7, y: mapBox.height * 0.5 } });
  await expect(page.getByTestId('route-status')).toContainText('Não foi possível calcular');
  const saveButton = page.getByRole('button', { name: 'Guardar percurso' });
  await expect(saveButton).toBeDisabled();

  routerUp = true;
  await page.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(page.getByTestId('route-status')).toContainText('Percurso pelas estradas');
  const patched = page.waitForResponse((r) => r.url().endsWith(`/api/vias/${vid}`) && r.request().method() === 'PATCH');
  await saveButton.click();
  expect((await patched).status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(`/vias/${vid}$`));
  const redrawn = await (await page.request.get(`/api/vias/${vid}`)).json();
  expect(redrawn.geoLocationPath).toBe('32.570000,-25.950000;32.575000,-25.955000;32.600000,-25.970000');
  // A path the server cannot read is refused
  const bad = await page.request.patch(`/api/vias/${vid}`, { data: { geoLocationPath: 'not a path' } });
  expect(bad.status()).toBe(400);
  expect((await page.request.patch('/api/vias/no-such-route', { data: { nome: 'x' } })).status()).toBe(404);

  await deleteFromDetail(page, `/vias/${vid}`, `/api/vias/${vid}`);
});

test('Via: "Atribuir Transporte" muda a via do transporte', async ({ page }) => {
  const vias = await (await page.request.get('/api/vias?limit=1')).json();
  const via = vias.data[0];
  const transportes = await (await page.request.get('/api/transportes')).json();
  const transporte = transportes.data.find((t: { viaId: string | null }) => t.viaId !== via.id);
  const viaOriginal: string | null = transporte.viaId;

  try {
    await page.goto(`/vias/${via.id}/editar`);
    await page.getByRole('button', { name: 'Atribuir Transporte' }).click();
    await page.getByText(transporte.matricula, { exact: true }).click();
    const patched = page.waitForResponse((r) => r.url().endsWith(`/api/transportes/${transporte.id}`) && r.request().method() === 'PATCH');
    await page.getByRole('button', { name: /^Atribuir \(1\)$/ }).click();
    expect((await patched).ok()).toBeTruthy();
    await expect(page.getByText('1 transporte(s) atribuído(s) com sucesso!')).toBeVisible();

    const depois = await (await page.request.get(`/api/transportes/${transporte.id}`)).json();
    expect(depois.viaId).toBe(via.id);
  } finally {
    // Put the vehicle back on its route
    await page.request.patch(`/api/transportes/${transporte.id}`, { data: { viaId: viaOriginal } });
  }
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

test('Proprietário com transporte: "Remover Associações e Eliminar" elimina-o e mantém o transporte', async ({ page }) => {
  const id = uid();
  const nome = `E2E Proprietário ${id}`;
  const created = await page.request.post('/api/proprietarios', {
    data: {
      nome, bi: `${digits(12)}E`, nacionalidade: 'Moçambicana', birthDate: '2020-01-15',
      endereco: 'Av. de Teste, 4, Maputo', contacto1: `84${digits(7)}`,
    },
  });
  expect(created.ok()).toBeTruthy();
  const oid = (await created.json()).id as string;
  const vehicles = await (await page.request.get('/api/transportes?limit=1')).json();
  const tid = vehicles.data[0].id as string;
  expect((await page.request.post(`/api/transportes/${tid}/atribuir-proprietario`, { data: { proprietarioId: oid } })).ok()).toBeTruthy();

  await page.goto('/proprietarios');
  await page.getByPlaceholder('Pesquisar por nome, BI ou nacionalidade...').fill(nome);
  const row = page.getByRole('row').filter({ hasText: nome });
  await row.getByTitle('Eliminar').click();
  // The dialog's button (the row icons are also called "Eliminar", but through their title)
  await page.locator('button:not([title])', { hasText: /^\s*Eliminar\s*$/ }).click();
  await expect(page.getByText('Não é Possível Eliminar')).toBeVisible();

  const deleted = page.waitForResponse((r) => r.url().includes(`/api/proprietarios/${oid}`) && r.request().method() === 'DELETE');
  await page.getByRole('button', { name: 'Remover Associações e Eliminar' }).click();
  expect((await deleted).ok()).toBeTruthy();

  expect((await page.request.get(`/api/proprietarios/${oid}`)).status()).toBe(404);
  expect((await page.request.get(`/api/transportes/${tid}`)).ok()).toBeTruthy();
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
  // No password field: drivers get a PIN from their page (pin.spec.ts)
  await expect(page.getByText('Gerar PIN', { exact: false })).toBeVisible();
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
