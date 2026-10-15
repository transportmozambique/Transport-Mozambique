const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  try {
    console.log('=== CHECKING DATABASE ===\n');
    
    // Check Vias
    const viasCount = await prisma.via.count();
    console.log(`✅ Total Vias: ${viasCount}`);
    
    if (viasCount > 0) {
      const sampleVias = await prisma.via.findMany({
        take: 3,
        select: {
          id: true,
          nome: true,
          codigo: true,
          terminalPartida: true,
          terminalChegada: true,
          _count: {
            select: {
              paragens: true,
              transportes: true,
            }
          }
        }
      });
      
      console.log('\n📍 Sample Vias:');
      sampleVias.forEach((via, i) => {
        console.log(`   ${i + 1}. ${via.nome} (${via.codigo})`);
        console.log(`      ${via.terminalPartida} → ${via.terminalChegada}`);
        console.log(`      Paragens: ${via._count.paragens}, Transportes: ${via._count.transportes}`);
      });
    }
    
    // Check Proprietarios
    const proprietariosCount = await prisma.proprietario.count();
    console.log(`\n✅ Total Proprietários: ${proprietariosCount}`);
    
    if (proprietariosCount > 0) {
      const sampleProprietarios = await prisma.proprietario.findMany({
        take: 3,
        select: {
          id: true,
          nome: true,
          bi: true,
          contacto1: true,
          _count: {
            select: {
              transportes: true,
            }
          }
        }
      });
      
      console.log('\n👤 Sample Proprietários:');
      sampleProprietarios.forEach((prop, i) => {
        console.log(`   ${i + 1}. ${prop.nome}`);
        console.log(`      BI: ${prop.bi}, Tel: ${prop.contacto1}`);
        console.log(`      Transportes: ${prop._count.transportes}`);
      });
    }
    
    console.log('\n' + '='.repeat(50));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
