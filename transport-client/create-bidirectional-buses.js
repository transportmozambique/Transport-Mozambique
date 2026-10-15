const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createBidirectionalBuses() {
  try {
    console.log('🔄 Criando autocarros bidirecionais...\n');
    
    // Get all vias with only 1 transporte (unidirectional)
    const vias = await prisma.via.findMany({
      include: {
        transportes: true,
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
    
    const viasComUmTransporte = vias.filter(v => v.transportes.length === 1);
    
    console.log(`📊 Encontradas ${viasComUmTransporte.length} vias com apenas 1 transporte\n`);
    
    if (viasComUmTransporte.length === 0) {
      console.log('✅ Todas as vias já têm transportes bidirecionais!');
      return;
    }
    
    // Get the highest existing codigo
    const lastTransporte = await prisma.transporte.findFirst({
      orderBy: {
        codigo: 'desc'
      }
    });
    
    let nextCodigo = lastTransporte ? lastTransporte.codigo + 1 : 10000;
    
    const created = [];
    
    for (const via of viasComUmTransporte) {
      // Get last stop location for initial position (reverse direction)
      let initialLocation = '-25.9655,32.5892'; // Default Maputo center
      
      if (via.paragens.length > 0) {
        // Start from last stop (reverse direction)
        initialLocation = via.paragens[via.paragens.length - 1].paragem.geoLocation;
      }
      
      // Reverse the route path
      let routePath = via.geoLocationPath;
      
      if (routePath) {
        // Reverse the coordinates
        const coords = routePath.split(';');
        routePath = coords.reverse().join(';');
      } else if (via.paragens.length > 0) {
        // Create reversed route path from stops
        routePath = via.paragens
          .reverse()
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
          codigo: via.codigo,
          direction: 'reverse'
        });
        
        console.log(`✅ Criado: ${matricula} para ${via.nome} (direção reversa)`);
        nextCodigo++;
        
      } catch (error) {
        console.error(`❌ Erro ao criar transporte para ${via.nome}:`, error.message);
      }
    }
    
    console.log(`\n✅ Criados ${created.length} novos autocarros bidirecionais!`);
    console.log(`\n📊 Estatísticas finais:`);
    
    const totalTransportes = await prisma.transporte.count();
    const totalVias = await prisma.via.count();
    const viasComDoisOuMais = await prisma.via.count({
      where: {
        transportes: {
          some: {}
        }
      }
    });
    
    console.log(`  Total de autocarros: ${totalTransportes}`);
    console.log(`  Total de vias: ${totalVias}`);
    console.log(`  Vias com 2+ autocarros: ${viasComDoisOuMais}`);
    console.log(`  Média de autocarros por via: ${(totalTransportes / totalVias).toFixed(1)}`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

createBidirectionalBuses();
