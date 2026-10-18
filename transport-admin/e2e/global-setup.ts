import { chromium, type FullConfig } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

export const E2E_ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL || 'e2e-admin@local.test',
  senha: process.env.E2E_ADMIN_PASSWORD || 'e2e-local-only-pass',
};

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export default async function globalSetup(config: FullConfig) {
  const databaseUrl = process.env.E2E_DATABASE_URL || 'postgresql://postgres@127.0.0.1:55432/transport_test';
  const host = new URL(databaseUrl).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`E2E tests write to the database; refusing to run against ${host}. Use a local database.`);
  }

  // O administrador de teste só existe na base de dados local, por isso a entrada abaixo também prova
  // que o servidor em teste está ligado a ela e não à produção.
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const senha = await bcrypt.hash(E2E_ADMIN.senha, 10);
  await prisma.administrador.upsert({
    where: { email: E2E_ADMIN.email },
    update: { senha },
    create: { nome: 'E2E Admin', email: E2E_ADMIN.email, senha },
  });
  await prisma.$disconnect();

  const { baseURL, storageState } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  await page.goto('/login');
  await page.fill('#email', E2E_ADMIN.email);
  await page.fill('#senha', E2E_ADMIN.senha);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/auth/admin/login')),
    page.click('button[type=submit]'),
  ]);
  if (!response.ok()) {
    throw new Error(`Login as ${E2E_ADMIN.email} failed (${response.status()}): is the server using the e2e database?`);
  }
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
  fs.mkdirSync(path.dirname(String(storageState)), { recursive: true });
  await page.context().storageState({ path: String(storageState) });
  await browser.close();
}
