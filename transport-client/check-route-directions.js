const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRouteDirections() {
  try {
    const vias = await prisma.via.findMany({
      select: {
        id: true,
        nome: true,
        terminalPartida: true,
        terminalChegada: true,
        _count: {
          select: {
            transportes: true
          }
        }
      }
    });
    
    const routes = {};
    
    vias.forEach(v => {
      const key = `${v.terminalPartida} → ${v.terminalChegada}`;
      if (!routes[key]) {
        routes[key] = [];
      }
      routes[key].push({
        nome: v.nome,
        transportes: v._count.transportes
      });
    });
    
    console.log('📊 Análise de Direções de Rotas:\n');
    
    const routeKeys = Object.keys(routes);
    let bidirectionalCount = 0;
    let unidirectionalCount = 0;
    
    const checked = new Set();
    
    routeKeys.forEach(key => {
      if (checked.has(key)) return;
      
      const [partida, chegada] = key.split(' → ');
      const reverseKey = `${chegada} → ${partida}`;
      
      if (routes[reverseKey]) {
        bidirectionalCount++;
        checked.add(key);
        checked.add(reverseKey);
        
        console.log(`✅ Bidirecional: ${key}`);
        console.log(`   Ida: ${routes[key].length} via(s), ${routes[key].reduce((sum, v) => sum + v.transportes, 0)} autocarro(s)`);
        console.log(`   Volta: ${routes[reverseKey].length} via(s), ${routes[reverseKey].reduce((sum, v) => sum + v.transportes, 0)} autocarro(s)`);
        console.log('');
      } else {
        unidirectionalCount++;
        checked.add(key);
        
        console.log(`⚠️  Unidirecional: ${key}`);
        console.log(`   ${routes[key].length} via(s), ${routes[key].reduce((sum, v) => sum + v.transportes, 0)} autocarro(s)`);
        console.log('');
      }
    });
    
    console.log('\n📊 Resumo:');
    console.log(`  Rotas bidirecionais: ${bidirectionalCount}`);
    console.log(`  Rotas unidirecionais: ${unidirectionalCount}`);
    console.log(`  Total de vias: ${vias.length}`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkRouteDirections();
