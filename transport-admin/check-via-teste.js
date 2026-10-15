const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando via "teste"...\n');

  // Find via by name
  const via = await prisma.via.findFirst({
    where: {
      nome: {
        contains: 'teste',
        mode: 'insensitive'
      }
    },
    include: {
      transportes: {
        select: {
          id: true,
          matricula: true,
          codigo: true,
          viaId: true,
        }
      },
      _count: {
        select: {
          transportes: true
        }
      }
    }
  });

  if (!via) {
    console.log('❌ Via "teste" não encontrada');
    return;
  }

  console.log('📊 Via encontrada:');
  console.log(`   ID: ${via.id}`);
  console.log(`   Nome: ${via.nome}`);
  console.log(`   Código: ${via.codigo}`);
  console.log(`   _count.transportes: ${via._count.transportes}`);
  console.log(`   transportes.length: ${via.transportes.length}`);
  console.log('');

  if (via.transportes.length > 0) {
    console.log('✅ Transportes associados:');
    via.transportes.forEach(t => {
      console.log(`   - ${t.matricula} (${t.codigo}) - viaId: ${t.viaId}`);
    });
  } else {
    console.log('⚠️  Nenhum transporte associado a esta via');
    
    // Check if there are transportes with this viaId
    const transportesComEstaVia = await prisma.transporte.findMany({
      where: {
        viaId: via.id
      },
      select: {
        id: true,
        matricula: true,
        codigo: true,
        viaId: true,
      }
    });

    console.log(`\n🔍 Transportes com viaId = "${via.id}": ${transportesComEstaVia.length}`);
    if (transportesComEstaVia.length > 0) {
      transportesComEstaVia.forEach(t => {
        console.log(`   - ${t.matricula} (${t.codigo})`);
      });
    }
  }

  // Check if there's a transporte named "teste"
  console.log('\n🔍 Procurando transporte "teste"...');
  const transporteTeste = await prisma.transporte.findFirst({
    where: {
      matricula: {
        contains: 'teste',
        mode: 'insensitive'
      }
    },
    include: {
      via: {
        select: {
          id: true,
          nome: true,
          codigo: true,
        }
      }
    }
  });

  if (transporteTeste) {
    console.log('✅ Transporte "teste" encontrado:');
    console.log(`   ID: ${transporteTeste.id}`);
    console.log(`   Matrícula: ${transporteTeste.matricula}`);
    console.log(`   Código: ${transporteTeste.codigo}`);
    console.log(`   viaId: ${transporteTeste.viaId}`);
    if (transporteTeste.via) {
      console.log(`   Via: ${transporteTeste.via.nome} (${transporteTeste.via.codigo})`);
    } else {
      console.log('   Via: Nenhuma');
    }
  } else {
    console.log('❌ Transporte "teste" não encontrado');
  }
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
