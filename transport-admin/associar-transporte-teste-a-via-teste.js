const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔗 Associando transporte "teste" à via "teste"...\n');

  // Find via "teste"
  const via = await prisma.via.findFirst({
    where: {
      nome: {
        contains: 'teste',
        mode: 'insensitive'
      }
    }
  });

  if (!via) {
    console.log('❌ Via "teste" não encontrada');
    return;
  }

  console.log(`✅ Via encontrada: ${via.nome} (${via.codigo})`);
  console.log(`   ID: ${via.id}\n`);

  // Find transporte "teste"
  const transporte = await prisma.transporte.findFirst({
    where: {
      matricula: {
        contains: 'teste',
        mode: 'insensitive'
      }
    },
    include: {
      via: {
        select: {
          nome: true,
          codigo: true,
        }
      }
    }
  });

  if (!transporte) {
    console.log('❌ Transporte "teste" não encontrado');
    return;
  }

  console.log(`✅ Transporte encontrado: ${transporte.matricula} (${transporte.codigo})`);
  console.log(`   ID: ${transporte.id}`);
  if (transporte.via) {
    console.log(`   Via atual: ${transporte.via.nome} (${transporte.via.codigo})`);
  } else {
    console.log(`   Via atual: Nenhuma`);
  }
  console.log('');

  // Update transporte to associate with via "teste"
  console.log('🔄 Atualizando associação...\n');

  const updated = await prisma.transporte.update({
    where: {
      id: transporte.id
    },
    data: {
      viaId: via.id,
      codigoVia: via.codigo
    }
  });

  console.log('✅ Transporte atualizado com sucesso!');
  console.log(`   ${updated.matricula} agora está associado à via ${via.nome}\n`);

  // Verify
  const viaAtualizada = await prisma.via.findUnique({
    where: {
      id: via.id
    },
    include: {
      transportes: {
        select: {
          matricula: true,
          codigo: true,
        }
      },
      _count: {
        select: {
          transportes: true
        }
      }
    }
  });

  console.log('📊 Verificação:');
  console.log(`   Via: ${viaAtualizada.nome}`);
  console.log(`   Transportes: ${viaAtualizada._count.transportes}`);
  if (viaAtualizada.transportes.length > 0) {
    viaAtualizada.transportes.forEach(t => {
      console.log(`     - ${t.matricula} (${t.codigo})`);
    });
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
