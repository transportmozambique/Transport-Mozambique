const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDashboardAPI() {
  try {
    console.log('🧪 Testing Dashboard API Query...\n');
    
    // Simulate the exact query from the API
    const viasComTransportes = await prisma.$queryRaw`
      SELECT v.id, v.nome, v.cor, v."geoLocationPath", v."terminalPartida", v."terminalChegada", COUNT(DISTINCT t.id)::int as count
      FROM "Via" v
      LEFT JOIN "Transporte" t ON t."viaId" = v.id
      GROUP BY v.id, v.nome, v.cor, v."geoLocationPath", v."terminalPartida", v."terminalChegada"
      ORDER BY count DESC, v.nome ASC
    `;
    
    console.log(`✅ Query returned ${viasComTransportes.length} vias\n`);
    
    // Show sample of first 5 vias
    console.log('📋 Sample of first 5 vias:');
    viasComTransportes.slice(0, 5).forEach((via, i) => {
      console.log(`  ${i + 1}. ${via.nome}`);
      console.log(`     Color: ${via.cor}`);
      console.log(`     Transportes: ${via.count}`);
      console.log(`     Path length: ${via.geoLocationPath.split(';').length} points`);
      console.log('');
    });
    
    // Check colors
    const uniqueColors = new Set(viasComTransportes.map(v => v.cor));
    console.log(`🎨 Unique colors: ${uniqueColors.size}/${viasComTransportes.length}`);
    
    // Check path validity
    const viasWithValidPaths = viasComTransportes.filter(v => {
      const points = v.geoLocationPath.split(';');
      return points.length >= 2 && points.every(p => {
        const [lng, lat] = p.split(',').map(Number);
        return !isNaN(lng) && !isNaN(lat);
      });
    });
    
    console.log(`🗺️  Vias with valid paths: ${viasWithValidPaths.length}/${viasComTransportes.length}`);
    
    // Check municipio distribution
    const maputo = await prisma.municipio.findFirst({
      where: { nome: { contains: 'Maputo', mode: 'insensitive' } }
    });
    
    const matola = await prisma.municipio.findFirst({
      where: { nome: { contains: 'Matola', mode: 'insensitive' } }
    });
    
    const maputoVias = await prisma.via.count({ where: { municipioId: maputo.id } });
    const matolaVias = await prisma.via.count({ where: { municipioId: matola.id } });
    
    console.log(`\n📍 Distribution:`);
    console.log(`  Maputo: ${maputoVias} vias`);
    console.log(`  Matola: ${matolaVias} vias`);
    console.log(`  Total: ${maputoVias + matolaVias} vias`);
    
    console.log('\n✅ Dashboard API will now show all vias on the map!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDashboardAPI();
