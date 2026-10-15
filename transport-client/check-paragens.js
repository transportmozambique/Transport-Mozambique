const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkParagens() {
  const paragens = await prisma.paragem.findMany({
    where: {
      id: {
        in: ['cmorbs9vu002a124pcm29azr0', 'cmornovn6001tl1taii3watxh']
      }
    },
    select: {
      id: true,
      nome: true
    }
  });
  
  console.log('Paragens:');
  paragens.forEach(p => {
    console.log(`  ${p.nome} (${p.id})`);
  });
  
  // Check if there's a reverse route
  const vias = await prisma.via.findMany({
    where: {
      OR: [
        { terminalPartida: 'Albert Lithule', terminalChegada: 'Boquisso' },
        { terminalPartida: 'Boquisso', terminalChegada: 'Albert Lithule' }
      ]
    },
    select: {
      id: true,
      nome: true,
      terminalPartida: true,
      terminalChegada: true,
      transportes: {
        select: {
          matricula: true
        }
      }
    }
  });
  
  console.log('\nVias disponíveis:');
  vias.forEach(v => {
    console.log(`  ${v.terminalPartida} → ${v.terminalChegada}`);
    console.log(`    Nome: ${v.nome}`);
    console.log(`    Transportes: ${v.transportes.length}`);
  });
  
  await prisma.$disconnect();
}

checkParagens();
