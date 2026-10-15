const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('📊 Verificando estado dos proprietários...\n');

  // Get all transportes with proprietarios
  const transportes = await prisma.transporte.findMany({
    include: {
      proprietarios: {
        include: {
          proprietario: true
        }
      }
    }
  });

  const transportesComProprietario = transportes.filter(t => t.proprietarios.length > 0);
  const transportesSemProprietario = transportes.filter(t => t.proprietarios.length === 0);

  console.log(`Total transportes: ${transportes.length}`);
  console.log(`- Com proprietário: ${transportesComProprietario.length}`);
  console.log(`- Sem proprietário: ${transportesSemProprietario.length}\n`);

  if (transportesSemProprietario.length > 0) {
    console.log(`⚠️  ${transportesSemProprietario.length} transportes sem proprietário:\n`);
    transportesSemProprietario.slice(0, 10).forEach(t => {
      console.log(`   - ${t.matricula} (${t.codigo})`);
    });
    if (transportesSemProprietario.length > 10) {
      console.log(`   ... e mais ${transportesSemProprietario.length - 10}`);
    }
  } else {
    console.log('✅ Todos os transportes têm proprietário atribuído!');
  }

  // Get proprietarios stats
  const proprietarios = await prisma.proprietario.findMany({
    include: {
      transportes: true
    }
  });

  console.log(`\n📊 Proprietários:`);
  console.log(`   Total: ${proprietarios.length}`);
  
  const proprietariosComTransportes = proprietarios.filter(p => p.transportes.length > 0);
  console.log(`   - Com transportes: ${proprietariosComTransportes.length}`);
  console.log(`   - Sem transportes: ${proprietarios.length - proprietariosComTransportes.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
