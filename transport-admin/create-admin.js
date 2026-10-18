// Cria um administrador, ou define uma palavra-passe nova para um existente, na base de dados de
// DATABASE_URL (ambiente ou .env). Tudo é perguntado no terminal: nenhum email ou palavra-passe
// fica neste ficheiro, a palavra-passe não aparece no ecrã, e só se guarda o seu hash bcrypt.
// Porquê um script e não uma página: o primeiro administrador tem de existir antes de alguém poder entrar.
// Uso (em transport-admin): node create-admin.js
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const bcrypt = require('bcryptjs');

const MIN_PASSWORD_LENGTH = 10;

if (!process.env.DATABASE_URL) {
  const envFile = path.join(__dirname, '.env');
  if (fs.existsSync(envFile)) {
    const match = fs.readFileSync(envFile, 'utf8').match(/^DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
    if (match) process.env.DATABASE_URL = match[1];
  }
}
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL não definido (nem no ambiente, nem em .env).');
  process.exit(1);
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: Boolean(process.stdin.isTTY),
});
let muted = false;
rl._writeToOutput = (s) => {
  if (!muted) rl.output.write(s);
};
rl.on('SIGINT', () => {
  process.stdout.write('\nCancelado.\n');
  process.exit(130);
});
const lines = rl[Symbol.asyncIterator]();

async function ask(question, { hidden = false } = {}) {
  process.stdout.write(question);
  muted = hidden;
  const { value } = await lines.next();
  if (hidden) {
    muted = false;
    process.stdout.write('\n');
  }
  return (value || '').trim();
}

async function askPassword() {
  for (;;) {
    const senha = await ask(`Nova senha (mínimo ${MIN_PASSWORD_LENGTH} caracteres): `, { hidden: true });
    if (senha.length < MIN_PASSWORD_LENGTH) {
      console.log(`⚠️  A senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      continue;
    }
    const confirmacao = await ask('Repita a senha: ', { hidden: true });
    if (senha !== confirmacao) {
      console.log('⚠️  As senhas não coincidem.');
      continue;
    }
    return senha;
  }
}

async function main() {
  console.log(`Base de dados: ${new URL(process.env.DATABASE_URL).hostname}\n`);

  const admins = await prisma.administrador.findMany({
    select: { nome: true, email: true },
    orderBy: { email: 'asc' },
  });
  console.log(admins.length ? 'Administradores existentes:' : 'Ainda não há administradores.');
  for (const a of admins) console.log(`  - ${a.email} (${a.nome})`);
  console.log('');

  const email = await ask('Email do administrador: ');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('❌ Email inválido.');
    return 1;
  }

  const existing = await prisma.administrador.findUnique({ where: { email } });
  if (existing) {
    const resposta = await ask(`${email} já existe. Definir uma nova senha? (s/N): `);
    if (resposta.toLowerCase() !== 's') {
      console.log('Nada foi alterado.');
      return 0;
    }
    const senha = await askPassword();
    await prisma.administrador.update({ where: { email }, data: { senha: await bcrypt.hash(senha, 10) } });
    console.log(`✅ Senha de ${email} atualizada.`);
    return 0;
  }

  const nome = (await ask('Nome: ')) || 'Administrador';
  const senha = await askPassword();
  await prisma.administrador.create({ data: { nome, email, senha: await bcrypt.hash(senha, 10) } });
  console.log(`✅ Administrador ${email} criado.`);
  return 0;
}

main()
  .then((code) => (process.exitCode = code))
  .catch((error) => {
    console.error('❌ Erro:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
