const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkVias() {
  try {
    const vias = await prisma.via.findMany({
      include: { 
        municipio: true,
        _count: {
          select: {
            transportes: true,
            paragens: true
          }
        }
      }
    });
    
    console.log('📊 Current vias:', vias.length);
    
    const maputoVias = vias.filter(v => v.municipio?.nome === 'Maputo');
    const matolaVias = vias.filter(v => v.municipio?.nome === 'Matola');
    
    console.log('   Maputo vias:', maputoVias.length);
    console.log('   Matola vias:', matolaVias.length);
    console.log('   Unassigned:', vias.filter(v => !v.municipio).length);
    
    // Check for vias without municipio
    const orphanVias = vias.filter(v => !v.municipio);
    if (orphanVias.length > 0) {
      console.log('\n⚠️  Vias without município:');
      orphanVias.forEach(v => {
        console.log(`   - ${v.nome} (${v.codigo})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVias();
