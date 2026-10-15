import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const totalVias = await prisma.via.count();
  const totalTransportes = await prisma.transporte.count();
  
  console.log('📊 ESTATÍSTICAS:');
  console.log(`   Total de vias: ${totalVias}`);
  console.log(`   Total de transportes: ${totalTransportes}`);
  
  console.log('\n📋 EXEMPLOS DE TRANSPORTES COM VIAS:\n');
  
  const transportes = await prisma.transporte.findMany({
    take: 10,
    include: {
      via: true,
      motorista: {
        select: {
          nome: true
        }
      }
    }
  });
  
  transportes.forEach((t, i) => {
    console.log(`${i + 1}. ${t.matricula} (${t.marca} ${t.modelo})`);
    console.log(`   Via: ${t.via?.nome || 'Sem via'}`);
    console.log(`   Motorista: ${t.motorista?.nome || 'Sem motorista'}`);
    console.log();
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
