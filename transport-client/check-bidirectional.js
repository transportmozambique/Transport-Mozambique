const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBidirectional() {
  try {
    const vias = await prisma.via.findMany({
      include: {
        transportes: true
      }
    });
    
    const viasComUmTransporte = vias.filter(v => v.transportes.length === 1);
    const viasComDoisOuMais = vias.filter(v => v.transportes.length >= 2);
    
    console.log('📊 Análise de Transportes por Via:');
    console.log('  Vias com apenas 1 transporte:', viasComUmTransporte.length);
    console.log('  Vias com 2+ transportes:', viasComDoisOuMais.length);
    console.log('  Vias sem transportes:', vias.filter(v => v.transportes.length === 0).length);
    console.log('');
    
    console.log('⚠️  Vias com apenas 1 transporte (unidirecionais):');
    viasComUmTransporte.slice(0, 10).forEach(v => {
      console.log(`  - ${v.nome} (${v.transportes[0].matricula})`);
    });
    
    if (viasComUmTransporte.length > 10) {
      console.log(`  ... e mais ${viasComUmTransporte.length - 10} vias`);
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkBidirectional();
