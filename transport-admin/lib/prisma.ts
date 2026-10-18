import { PrismaClient } from '@prisma/client';

// Um só cliente Prisma por processo, com melhor tratamento das ligações.
// Os hashes dos PINs dos motoristas nunca são lidos pelo painel (excepto pela rota do PIN, com um select explícito).
function createClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production'
      ? ['error']
      : ['error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    omit: {
      motorista: { password: true },
    },
  });
}

const globalForPrisma = global as unknown as { prisma?: ReturnType<typeof createClient> };

export const prisma = globalForPrisma.prisma || createClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Tratar os erros de ligação sem derrubar a aplicação
prisma.$connect().catch((error) => {
  console.error('Falha ao ligar à base de dados:', error);
});
