const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTransportes() {
  try {
    console.log('🔍 Checking transportes in database...\n');
    
    const totalTransportes = await prisma.transporte.count();
    const totalVias = await prisma.via.count();
    const totalProprietarios = await prisma.proprietario.count();
    const totalMotoristas = await prisma.motorista.count();
    
    console.log('📊 Database Counts:');
    console.log(`  Transportes: ${totalTransportes}`);
    console.log(`  Vias: ${totalVias}`);
    console.log(`  Proprietários: ${totalProprietarios}`);
    console.log(`  Motoristas: ${totalMotoristas}`);
    console.log('');
    
    // Get sample transportes
    const sampleTransportes = await prisma.transporte.findMany({
      take: 10,
      include: {
        via: {
          select: { nome: true }
        },
        motorista: {
          select: { nome: true }
        }
      }
    });
    
    console.log('📋 Sample Transportes:');
    sampleTransportes.forEach((t, i) => {
      console.log(`  ${i + 1}. Código: ${t.codigo}, Matrícula: ${t.matricula}`);
      console.log(`     Via: ${t.via?.nome || 'Not assigned'}`);
      console.log(`     Motorista: ${t.motorista?.nome || 'Not assigned'}`);
      console.log('');
    });
    
    // Check assignments
    const transportesWithVia = await prisma.transporte.count({
      where: { viaId: { not: null } }
    });
    
    const transportesWithMotorista = await prisma.transporte.count({
      where: { motorista: { isNot: null } }
    });
    
    console.log('🔗 Assignments:');
    console.log(`  Transportes with via: ${transportesWithVia}/${totalTransportes}`);
    console.log(`  Transportes with motorista: ${transportesWithMotorista}/${totalTransportes}`);
    console.log('');
    
    if (totalTransportes < totalVias) {
      console.log('⚠️  WARNING: You have fewer transportes than vias!');
      console.log(`   Transportes: ${totalTransportes}`);
      console.log(`   Vias: ${totalVias}`);
      console.log('');
      console.log('💡 Recommendation: Create more transportes to match vias');
      console.log('   You need at least 111 transportes for 111 vias');
    } else {
      console.log('✅ Good: You have enough transportes for all vias');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTransportes();
