const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function redistributeVias() {
  try {
    console.log('🔄 Redistributing vias between Maputo and Matola...\n');

    // Get municipalities
    const municipios = await prisma.municipio.findMany();
    const municipioMaputo = municipios.find(m => m.nome === 'Maputo');
    const municipioMatola = municipios.find(m => m.nome === 'Matola');

    if (!municipioMaputo || !municipioMatola) {
      console.error('❌ Municipalities not found!');
      return;
    }

    console.log('✅ Found municipalities:');
    console.log('   Maputo:', municipioMaputo.id);
    console.log('   Matola:', municipioMatola.id);

    // Get all vias with their stops
    const vias = await prisma.via.findMany({
      include: {
        paragens: {
          include: {
            paragem: true
          }
        }
      }
    });

    console.log('\n📊 Total vias:', vias.length);

    let maputoCount = 0;
    let matolaCount = 0;
    let updated = 0;

    // Redistribute based on geographic location
    // Maputo is generally north of -25.9, Matola is south
    for (const via of vias) {
      // Parse the route path to get coordinates
      const coords = via.geoLocationPath.split(';').map(coord => {
        const [lng, lat] = coord.split(',').map(Number);
        return { lng, lat };
      });

      // Calculate average latitude
      const avgLat = coords.reduce((sum, c) => sum + c.lat, 0) / coords.length;

      // Also check stops if available
      let stopBasedDecision = null;
      if (via.paragens.length > 0) {
        const stopCoords = via.paragens.map(vp => {
          const [lng, lat] = vp.paragem.geoLocation.split(',').map(Number);
          return { lng, lat };
        });
        const avgStopLat = stopCoords.reduce((sum, c) => sum + c.lat, 0) / stopCoords.length;
        
        // If stops average is significantly different, use that
        if (Math.abs(avgStopLat - avgLat) > 0.05) {
          stopBasedDecision = avgStopLat > -25.9 ? municipioMaputo : municipioMatola;
        }
      }

      // Decide which municipality
      // Routes mostly in Maputo (north of -25.9)
      const targetMunicipio = stopBasedDecision || (avgLat > -25.9 ? municipioMaputo : municipioMatola);

      // Update if different
      if (via.municipioId !== targetMunicipio.id) {
        await prisma.via.update({
          where: { id: via.id },
          data: {
            municipioId: targetMunicipio.id,
            codigoMunicipio: targetMunicipio.codigo
          }
        });
        updated++;
      }

      if (targetMunicipio.id === municipioMaputo.id) {
        maputoCount++;
      } else {
        matolaCount++;
      }
    }

    console.log('\n✅ Redistribution complete!');
    console.log('   Maputo vias:', maputoCount);
    console.log('   Matola vias:', matolaCount);
    console.log('   Updated:', updated);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

redistributeVias();
