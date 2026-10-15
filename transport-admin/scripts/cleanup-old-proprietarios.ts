import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Deletar proprietários antigos sem transportes
  const result = await prisma.proprietario.deleteMany({
    where: {
      bi: {
        startsWith: '4000001'
      }
    }
  });

  console.log(`✅ Deletados ${result.count} proprietários antigos`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
