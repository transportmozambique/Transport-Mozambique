require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRoutesBuses() {
  console.log('🔍 Checking Routes and Buses\n');
  
  try {
    const routes = await prisma.via.findMany({
      include: {
        transportes: true
      },
      orderBy: {
        codigo: 'asc'
      }
    });
    
    console.log(`Total routes: ${routes.length}\n`);
    
    const withoutBuses = routes.filter(r => r.transportes.length === 0);
    
    if (withoutBuses.length > 0) {
      console.log(`❌ Routes without buses: ${withoutBuses.length}\n`);
      withoutBuses.forEach(r => {
        console.log(`  - ${r.codigo}: ${r.nome}`);
      });
    } else {
      console.log('✅ All routes have buses!\n');
    }
    
    // Show summary
    console.log('\nSummary by route:');
    routes.forEach(r => {
      console.log(`  ${r.codigo}: ${r.transportes.length} buses`);
    });
    
    const totalBuses = routes.reduce((sum, r) => sum + r.transportes.length, 0);
    console.log(`\nTotal buses: ${totalBuses}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRoutesBuses();
