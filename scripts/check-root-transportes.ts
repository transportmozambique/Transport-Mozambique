import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando transportes na raiz do projeto...\n');

  const transportes = await prisma.transporte.findMany({
    take: 20,
    orderBy: { matricula: 'asc' },
    include: {
      via: true
    }
  });

  console.log(`📊 Total encontrado: ${transportes.length} transportes\n`);

  transportes.forEach((t, i) => {
    console.log(`${i + 1}. ${t.matricula} - ${t.marca} ${t.modelo} (${t.cor})`);
    console.log(`   Via: ${t.via?.nome || 'N/A'}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
