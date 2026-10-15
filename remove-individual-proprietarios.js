const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function removeIndividuals() {
  try {
    console.log('=== REMOVENDO PROPRIETÁRIOS INDIVIDUAIS ===\n');

    // Get all individual proprietarios
    const individuos = await prisma.$queryRaw`
      SELECT id, nome
      FROM "Proprietario"
      WHERE "tipoProprietario" = 'Indivíduo'
    `;

    console.log(`Encontrados ${individuos.length} proprietários individuais:\n`);
    individuos.forEach(p => console.log(`  - ${p.nome}`));

    // Delete all individual proprietarios
    const result = await prisma.$executeRaw`
      DELETE FROM "Proprietario"
      WHERE "tipoProprietario" = 'Indivíduo'
    `;

    console.log(`\n✅ ${result} proprietários individuais removidos\n`);

    // Count remaining
    const empresas = await prisma.$queryRaw`
      SELECT COUNT(*) as total FROM "Proprietario" WHERE "tipoProprietario" = 'Empresa'
    `;

    console.log('=== TOTAIS FINAIS ===');
    console.log(`Empresas: ${empresas[0].total}`);
    console.log(`Indivíduos: 0`);

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

removeIndividuals();
