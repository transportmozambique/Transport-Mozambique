const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDistribution() {
  try {
    const maputo = await prisma.municipio.findFirst({
      where: { nome: { contains: 'Maputo', mode: 'insensitive' } },
      include: { _count: { select: { vias: true } } }
    });
    
    const matola = await prisma.municipio.findFirst({
      where: { nome: { contains: 'Matola', mode: 'insensitive' } },
      include: { _count: { select: { vias: true } } }
    });
    
    const totalVias = await prisma.via.count();
    const totalParagens = await prisma.paragem.count();
    
    console.log('📊 Current Distribution:');
    console.log('Maputo vias:', maputo?._count.vias || 0);
    console.log('Matola vias:', matola?._count.vias || 0);
    console.log('Total vias:', totalVias);
    console.log('Total paragens:', totalParagens);
    console.log('\nMunicipio IDs:');
    console.log('Maputo ID:', maputo?.id);
    console.log('Matola ID:', matola?.id);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDistribution();
