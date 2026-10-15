require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkViaParagem() {
  try {
    console.log('🔍 Checking ViaParagem relations...\n');

    // Count total stops
    const totalStops = await prisma.paragem.count();
    console.log(`📍 Total stops in database: ${totalStops}`);

    // Count total routes
    const totalRoutes = await prisma.via.count();
    console.log(`🛣️  Total routes in database: ${totalRoutes}`);

    // Count ViaParagem relations
    const totalRelations = await prisma.viaParagem.count();
    console.log(`🔗 Total ViaParagem relations: ${totalRelations}\n`);

    // Show routes with their stop counts
    const routesWithStops = await prisma.via.findMany({
      select: {
        codigo: true,
        nome: true,
        terminalPartida: true,
        terminalChegada: true,
        _count: {
          select: {
            paragens: true
          }
        }
      },
      orderBy: {
        codigo: 'asc'
      }
    });

    console.log('📊 Routes and their stop counts:');
    console.log('─'.repeat(80));
    routesWithStops.forEach(route => {
      console.log(`${route.codigo.padEnd(15)} | ${route.nome.padEnd(30)} | ${route._count.paragens} stops`);
      console.log(`  ${route.terminalPartida} → ${route.terminalChegada}`);
    });

    // Show sample ViaParagem relations
    if (totalRelations > 0) {
      console.log('\n📋 Sample ViaParagem relations:');
      const sampleRelations = await prisma.viaParagem.findMany({
        take: 10,
        include: {
          via: {
            select: {
              codigo: true,
              nome: true
            }
          },
          paragem: {
            select: {
              codigo: true,
              nome: true
            }
          }
        }
      });

      sampleRelations.forEach(rel => {
        console.log(`  ${rel.via.codigo} → ${rel.paragem.nome} ${rel.terminalBoolean ? '(Terminal)' : ''}`);
      });
    }

    // Check if any stops are NOT connected to routes
    const stopsWithoutRoutes = await prisma.paragem.findMany({
      where: {
        vias: {
          none: {}
        }
      },
      select: {
        codigo: true,
        nome: true
      },
      take: 20
    });

    if (stopsWithoutRoutes.length > 0) {
      console.log(`\n⚠️  Found ${stopsWithoutRoutes.length} stops NOT connected to any routes (showing first 20):`);
      stopsWithoutRoutes.forEach(stop => {
        console.log(`  - ${stop.nome} (${stop.codigo})`);
      });
    } else {
      console.log('\n✅ All stops are connected to at least one route!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkViaParagem();
