import { PrismaClient } from '@prisma/client';

// Create Prisma Client singleton with better connection handling.
// Driver PIN hashes are never read by the dashboard (except the PIN route, with an explicit select).
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

// Handle connection errors gracefully
prisma.$connect().catch((error) => {
  console.error('Failed to connect to database:', error);
});
