import { expect, type Page } from '@playwright/test';

/** Sufixo curto e único, para cada corrida criar as suas próprias linhas. */
export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();

/** A base de dados local de teste (o global-setup recusa qualquer outro servidor). */
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL || 'postgresql://postgres@127.0.0.1:55432/transport_test';

/** Só algarismos, para números de telefone e campos parecidos. */
export const digits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');

/**
 * As etiquetas dos formulários não estão ligadas aos seus campos, por isso um campo é encontrado
 * como o primeiro input, select ou textarea depois de uma etiqueta cujo texto começa por `label`.
 * `nth` escolhe entre etiquetas repetidas (ex: "Número *" para o BI e para a carta de condução).
 */
export function field(page: Page, label: string, nth = 0) {
  return page
    .locator(`xpath=//label[starts-with(normalize-space(.), "${label}")]`)
    .nth(nth)
    .locator('xpath=following::*[self::input or self::select or self::textarea][1]');
}

/** Escolhe a primeira opção real (índice 1, depois do "Selecione…") de um select. */
export async function selectFirstOption(page: Page, label: string) {
  const select = field(page, label);
  await expect(select.locator('option').nth(1)).toBeAttached();
  const value = await select.locator('option').nth(1).getAttribute('value');
  await select.selectOption(value!);
}

function findId(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const o = body as Record<string, unknown>;
  if (typeof o.id === 'string') return o.id;
  for (const v of Object.values(o)) {
    if (v && typeof v === 'object' && typeof (v as Record<string, unknown>).id === 'string') {
      return (v as Record<string, string>).id;
    }
  }
  return undefined;
}

/** Clica no botão de submeter e devolve o id da linha que a API criou. */
export async function submitCreate(page: Page, api: string, button: string) {
  const [response] = await Promise.all([
    page.waitForResponse((r) => new URL(r.url()).pathname === api && r.request().method() === 'POST'),
    page.getByRole('button', { name: button, exact: true }).click(),
  ]);
  const body = await response.json().catch(() => null);
  expect(response.status(), `POST ${api} → ${JSON.stringify(body)}`).toBeLessThan(300);
  const id = findId(body);
  expect(id, `no id in POST ${api} response`).toBeTruthy();
  return id!;
}

/** Clica no botão de guardar de um formulário de edição e espera que o pedido de actualização corra bem. */
export async function submitEdit(page: Page, api: string, button: string) {
  const [response] = await Promise.all([
    page.waitForResponse((r) => new URL(r.url()).pathname === api && ['PUT', 'PATCH'].includes(r.request().method())),
    page.getByRole('button', { name: button, exact: true }).click(),
  ]);
  expect(response.status(), `${response.request().method()} ${api} → ${await response.text()}`).toBeLessThan(300);
}

/** Abre a página de detalhe e verifica que mostra `text`. */
export async function expectDetail(page: Page, url: string, text: string) {
  await page.goto(url);
  await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
}

/** Pesquisa na página da lista e verifica que a linha lá está. */
export async function expectInList(page: Page, url: string, text: string) {
  await page.goto(url);
  await page.getByPlaceholder(/^Pesquisar por/).fill(text);
  await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
}

/** Apaga a partir da página de detalhe ("Eliminar", e depois a confirmação do diálogo) e verifica que a API devolve 404. */
export async function deleteFromDetail(page: Page, url: string, api: string) {
  await page.goto(url);
  await page.getByRole('button', { name: 'Eliminar', exact: true }).first().click();
  // Os diálogos de confirmação são camadas de ecrã inteiro (`fixed inset-0`) sem o papel dialog.
  const confirm = page.locator('.fixed.inset-0').getByRole('button', { name: /^(Remover e )?Eliminar$/ });
  const [response] = await Promise.all([
    page.waitForResponse((r) => new URL(r.url()).pathname === api && r.request().method() === 'DELETE'),
    confirm.click(),
  ]);
  expect(response.status(), `DELETE ${api} → ${await response.text()}`).toBeLessThan(300);
  const after = await page.request.get(api);
  expect(after.status()).toBe(404);
}
