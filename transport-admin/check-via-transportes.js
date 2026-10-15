const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando transportes nas vias...\n');

  // Get first 5 vias with transportes
  const vias = await prisma.via.findMany({
    include: {
      transportes: {
        select: {
          id: true,
          matricula: true,
          codigo: true,
        }
      },
      _count: {
        select: {
          transportes: true
        }
      }
    },
    take: 5
  });

  console.log(`📊 Primeiras 5 vias:\n`);
  vias.forEach(via => {
    console.log(`Via: ${via.nome} (${via.codigo})`);
    console.log(`  _count.transportes: ${via._count.transportes}`);
    console.log(`  transportes.length: ${via.transportes.length}`);
    if (via.transportes.length > 0) {
      console.log(`  Transportes:`);
      via.transportes.forEach(t => {
        console.log(`    - ${t.matricula} (${t.codigo})`);
      });
    }
    console.log('');
  });

  // Check if any transporte has viaId
  const transportesComVia = await prisma.transporte.findMany({
    where: {
      viaId: {
        not: null
      }
    },
    select: {
      id: true,
      matricula: true,
      codigo: true,
      viaId: true,
      via: {
        select: {
          nome: true,
          codigo: true
        }
      }
    },
    take: 10
  });

  console.log(`\n📦 Primeiros 10 transportes com via:\n`);
  transportesComVia.forEach(t => {
    console.log(`${t.matricula} (${t.codigo}) -> Via: ${t.via?.nome} (${t.via?.codigo})`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
