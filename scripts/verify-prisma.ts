import { prisma } from '../lib/prisma';

async function main() {
  try {
    console.log('🔍 Verifying Prisma Postgres connection...\n');

    // Test connection
    await prisma.$connect();
    console.log('✅ Connected to Prisma Postgres\n');

    // Count records
    const transportCount = await prisma.transporte.count();
    const viaCount = await prisma.via.count();
    const paragemCount = await prisma.paragem.count();
    const utenteCount = await prisma.utente.count();

    console.log('📊 Database Statistics:');
    console.log(`   - Transportes: ${transportCount}`);
    console.log(`   - Vias: ${viaCount}`);
    console.log(`   - Paragens: ${paragemCount}`);
    console.log(`   - Utentes: ${utenteCount}\n`);

    // Fetch one transport with details
    const transport = await prisma.transporte.findFirst({
      include: {
        via: true,
      },
    });

    if (transport) {
      console.log('🚌 Sample Transport:');
      console.log(`   - Matrícula: ${transport.matricula}`);
      console.log(`   - Via: ${transport.via.nome}`);
      console.log(`   - Localização: ${transport.currGeoLocation || 'N/A'}\n`);
    }

    console.log('✅ Verification complete! Database is working correctly.\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
