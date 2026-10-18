// Preparação do Jest

// Os testes usam a base de dados de DATABASE_URL (ambiente, ou .env como o Prisma o lê), e o
// auth.test.ts cria um administrador com uma palavra-passe conhecida. Recusa-se tudo o que não
// seja uma base de dados local, para `npm test` nunca poder escrever na produção.
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
  throw new Error('DATABASE_URL não está definida: apontá-la para uma base de dados local de teste.');
}
const host = new URL(url).hostname;
if (!LOCAL_HOSTS.has(host)) {
  throw new Error(`Os testes Jest escrevem na base de dados; recusam correr contra ${host}. Usar uma base de dados local.`);
}

// Silenciar o console durante os testes (opcional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };
