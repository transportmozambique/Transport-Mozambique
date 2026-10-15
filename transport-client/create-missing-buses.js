const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createMissingBuses() {
  try {
    console.log('🚌 Criando autocarros para vias sem transportes...\n');
    
    // Get all vias without transportes
    const viasSemTransportes = await prisma.via.findMany({
      where: {
        transportes: {
          none: {}
        }
      },
      include: {
        paragens: {
          include: {
            paragem: true
          },
          orderBy: {
            id: 'asc'
          }
        }
      }
    });
    
    console.log(`📊 Encontradas ${viasSemTransportes.length} vias sem transportes\n`);
    
    if (viasSemTransportes.length === 0) {
      console.log('✅ Todas as vias já têm transportes!');
      return;
    }
    
    // Get the highest existing codigo
    const lastTransporte = await prisma.transporte.findFirst({
      orderBy: {
        codigo: 'desc'
      }
    });
    
    let nextCodigo = lastTransporte ? lastTransporte.codigo + 1 : 9100;
    
    const created = [];
    
    for (const via of viasSemTransportes) {
      // Get first stop location for initial position
      let initialLocation = '-25.9655,32.5892'; // Default Maputo center
      
      if (via.paragens.length > 0) {
        initialLocation = via.paragens[0].paragem.geoLocation;
      }
      
      // Generate route path from via's geoLocationPath or from stops
      let routePath = via.geoLocationPath;
      
      if (!routePath && via.paragens.length > 0) {
        // Create route path from stops
        routePath = via.paragens
          .map(vp => {
            const [lat, lng] = vp.paragem.geoLocation.split(',');
            return `${lng},${lat}`;
          })
          .join(';');
      }
      
      const matricula = `BUS-${nextCodigo}`;
      
      try {
        const transporte = await prisma.transporte.create({
          data: {
            matricula: matricula,
            modelo: 'Autocarro Urbano',
            marca: 'Mercedes-Benz',
            cor: 'Branco',
            lotacao: 50,
            codigo: nextCodigo,
            codigoVia: via.codigo,
            viaId: via.id,
            currGeoLocation: initialLocation,
            routePath: routePath,
          }
        });
        
        created.push({
          matricula: transporte.matricula,
          via: via.nome,
          codigo: via.codigo
        });
        
        console.log(`✅ Criado: ${matricula} para ${via.nome}`);
        nextCodigo++;
        
      } catch (error) {
        console.error(`❌ Erro ao criar transporte para ${via.nome}:`, error.message);
      }
    }
    
    console.log(`\n✅ Criados ${created.length} novos autocarros!`);
    console.log('\n📋 Resumo:');
    created.forEach(t => {
      console.log(`  ${t.matricula} → ${t.via}`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

createMissingBuses();
