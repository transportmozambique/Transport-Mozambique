import { expect, type Page } from '@playwright/test';

/** Short unique suffix so every run creates its own rows. */
export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();

/** The local test database (global-setup refuses any other host). */
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL || 'postgresql://postgres@127.0.0.1:55432/transport_test';

/** Digits only, for phone numbers and similar fields. */
export const digits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');

/**
 * The form labels are not linked to their inputs, so fields are found as the first input, select
 * or textarea after a label whose text starts with `label`. `nth` picks repeated labels
 * (e.g. "Número *" for the ID card and for the driving licence).
 */
export function field(page: Page, label: string, nth = 0) {
  return page
    .locator(`xpath=//label[starts-with(normalize-space(.), "${label}")]`)
    .nth(nth)
    .locator('xpath=following::*[self::input or self::select or self::textarea][1]');
}

/** Picks the first real option (index 1, after the "Selecione…" placeholder) of a select. */
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

/** Clicks the submit button and returns the id of the row the API created. */
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

/** Clicks the save button of an edit form and waits for the update request to succeed. */
export async function submitEdit(page: Page, api: string, button: string) {
  const [response] = await Promise.all([
    page.waitForResponse((r) => new URL(r.url()).pathname === api && ['PUT', 'PATCH'].includes(r.request().method())),
    page.getByRole('button', { name: button, exact: true }).click(),
  ]);
  expect(response.status(), `${response.request().method()} ${api} → ${await response.text()}`).toBeLessThan(300);
}

/** Opens the detail page and checks it shows `text`. */
export async function expectDetail(page: Page, url: string, text: string) {
  await page.goto(url);
  await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
}

/** Searches the list page and checks the row is there. */
export async function expectInList(page: Page, url: string, text: string) {
  await page.goto(url);
  await page.getByPlaceholder(/^Pesquisar por/).fill(text);
  await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
}

/** Deletes from the detail page ("Eliminar", then the dialog's confirm) and checks the API returns 404. */
export async function deleteFromDetail(page: Page, url: string, api: string) {
  await page.goto(url);
  await page.getByRole('button', { name: 'Eliminar', exact: true }).first().click();
  // The confirmation dialogs are full-screen overlays (`fixed inset-0`) without a dialog role.
  const confirm = page.locator('.fixed.inset-0').getByRole('button', { name: /^(Remover e )?Eliminar$/ });
  const [response] = await Promise.all([
    page.waitForResponse((r) => new URL(r.url()).pathname === api && r.request().method() === 'DELETE'),
    confirm.click(),
  ]);
  expect(response.status(), `DELETE ${api} → ${await response.text()}`).toBeLessThan(300);
  const after = await page.request.get(api);
  expect(after.status()).toBe(404);
}
