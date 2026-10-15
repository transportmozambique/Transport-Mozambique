const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkProvincias() {
  try {
    console.log('🔍 Verificando províncias na base de dados...\n');

    const provincias = await prisma.provincia.findMany({
      select: {
        id: true,
        nome: true,
        codigo: true,
        geoLocation: true,
        _count: {
          select: {
            municipios: true,
          },
        },
      },
    });

    console.log(`📊 Total de províncias: ${provincias.length}\n`);

    if (provincias.length === 0) {
      console.log('❌ Nenhuma província encontrada na base de dados.');
      console.log('\n💡 Você pode criar províncias usando:');
      console.log('   1. Interface web: http://localhost:3000/provincias/novo');
      console.log('   2. Ou executar: node scripts/seed-provincias.js\n');
    } else {
      console.log('✅ Províncias encontradas:\n');
      provincias.forEach((provincia, index) => {
        console.log(`${index + 1}. ${provincia.nome} (${provincia.codigo})`);
        console.log(`   ID: ${provincia.id}`);
        console.log(`   Localização: ${provincia.geoLocation || 'Não definida'}`);
        console.log(`   Municípios: ${provincia._count.municipios}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Erro ao verificar províncias:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProvincias();
