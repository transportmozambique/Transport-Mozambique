// Jest setup file

// The suites use the database named by DATABASE_URL (environment, or .env as Prisma reads it), and
// auth.test.ts creates an administrator with a known password. Refuse anything but a local
// database, so `npm test` can never write to production.
const fs = require('fs');
const path = require('path');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envFile = path.join(__dirname, '.env');
  if (!fs.existsSync(envFile)) return null;
  const match = fs.readFileSync(envFile, 'utf8').match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
  return match ? match[1] : null;
}

const url = databaseUrl();
if (!url) {
  throw new Error('DATABASE_URL is not set: point it at a local test database.');
}
const host = new URL(url).hostname;
if (!LOCAL_HOSTS.has(host)) {
  throw new Error(`The Jest suites write to the database; refusing to run against ${host}. Use a local database.`);
}

// Suppress console logs during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };
