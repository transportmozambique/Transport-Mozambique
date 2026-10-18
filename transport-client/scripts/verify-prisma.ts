import { prisma } from '../lib/prisma';

async function main() {
  try {
    console.log('A verificar a ligação à base de dados...\n');

    // Testar a ligação
    await prisma.$connect();
    console.log('Ligado à base de dados\n');

    // Contar os registos
    const transportCount = await prisma.transporte.count();
    const viaCount = await prisma.via.count();
    const paragemCount = await prisma.paragem.count();
    const utenteCount = await prisma.utente.count();

    console.log('Linhas na base de dados:');
    console.log(`   - Transportes: ${transportCount}`);
    console.log(`   - Vias: ${viaCount}`);
    console.log(`   - Paragens: ${paragemCount}`);
    console.log(`   - Utentes: ${utenteCount}\n`);

    // Ler um transporte com os detalhes
    const transport = await prisma.transporte.findFirst({
      include: {
        via: true,
      },
    });

    if (transport) {
      console.log('Um transporte de exemplo:');
      console.log(`   - Matrícula: ${transport.matricula}`);
      console.log(`   - Via: ${transport.via?.nome ?? 'N/A'}`);
      console.log(`   - Localização: ${transport.currGeoLocation || 'N/A'}\n`);
    }

    console.log('Verificação concluída: a base de dados funciona.\n');
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
