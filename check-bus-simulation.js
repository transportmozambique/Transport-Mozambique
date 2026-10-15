require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBusSimulation() {
  console.log('🔍 Checking bus simulation status...\n');

  // Check how many buses have routePath
  const busesWithRoutePath = await prisma.transporte.count({
    where: {
      routePath: {
        not: null
      }
    }
  });

  const totalBuses = await prisma.transporte.count();

  console.log(`📊 Buses with routePath: ${busesWithRoutePath}/${totalBuses}`);

  // Check a few buses and their current positions
  const sampleBuses = await prisma.transporte.findMany({
    take: 5,
    include: {
      via: {
        select: {
          codigo: true,
          nome: true,
          geoLocationPath: true
        }
      },
      geoLocations: {
        take: 1,
        orderBy: {
          createdAt: 'desc'
        }
      }
    }
  });

  console.log('\n📍 Sample bus positions:');
  sampleBuses.forEach(bus => {
    console.log(`\n  Bus: ${bus.matricula} (${bus.via.codigo})`);
    console.log(`  currGeoLocation: ${bus.currGeoLocation || 'NULL'}`);
    console.log(`  routePath: ${bus.routePath ? 'SET' : 'NULL'}`);
    console.log(`  via.geoLocationPath: ${bus.via.geoLocationPath ? 'SET' : 'NULL'}`);
    if (bus.geoLocations.length > 0) {
      console.log(`  Latest geoLocation: ${bus.geoLocations[0].geoLocationTransporte}`);
      console.log(`  Direction: ${bus.geoLocations[0].geoDirection}`);
      console.log(`  Updated: ${bus.geoLocations[0].createdAt}`);
    }
  });

  // Check if positions are being updated recently
  const recentUpdates = await prisma.geoLocation.count({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
      }
    }
  });

  console.log(`\n⏰ GeoLocations updated in last 5 minutes: ${recentUpdates}`);

  await prisma.$disconnect();
}

checkBusSimulation().catch(console.error);
