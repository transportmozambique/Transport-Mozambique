const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const viaCodigo = process.argv[2] || 'V027';
  
  console.log(`🔍 Showing Stops for ${viaCodigo}\n`);
  console.log('='.repeat(80) + '\n');

  const via = await prisma.via.findUnique({
    where: { codigo: viaCodigo },
    include: {
      paragens: {
        include: {
          paragem: true
        },
        orderBy: {
          paragem: {
            codigo: 'asc'
          }
        }
      }
    }
  });

  if (!via) {
    console.log(`❌ Via ${viaCodigo} not found!`);
    return;
  }

  console.log(`📍 ${via.codigo}: ${via.nome}`);
  console.log(`   Terminal Partida: ${via.terminalPartida}`);
  console.log(`   Terminal Chegada: ${via.terminalChegada}`);
  console.log(`   Total stops: ${via.paragens.length}\n`);

  console.log('📊 ASSOCIATED STOPS:\n');
  
  via.paragens.forEach((vp, idx) => {
    const terminal = vp.terminalBoolean ? ' [TERMINAL]' : '';
    console.log(`${(idx + 1).toString().padStart(3)}. ${vp.paragem.codigo}: ${vp.paragem.nome}${terminal}`);
    console.log(`     Location: ${vp.paragem.geoLocation}\n`);
  });

  console.log('='.repeat(80));
  console.log('✅ Complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
