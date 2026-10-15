const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateProprietariosTipo() {
  try {
    console.log('Atualizando proprietários com tipo usando SQL...\n');

    // Update empresas (nomes com Lda, Ltda, Transportes, etc.)
    const empresasResult = await prisma.$executeRaw`
      UPDATE "Proprietario"
      SET "tipoProprietario" = 'Empresa'
      WHERE LOWER("nome") LIKE '%lda%'
         OR LOWER("nome") LIKE '%ltda%'
         OR LOWER("nome") LIKE '%transportes%'
         OR LOWER("nome") LIKE '%empresa%'
         OR LOWER("nome") LIKE '%sa%'
         OR LOWER("nome") LIKE '%sarl%'
    `;

    console.log(`✓ ${empresasResult} empresas atualizadas`);

    // Update indivíduos (resto)
    const individuosResult = await prisma.$executeRaw`
      UPDATE "Proprietario"
      SET "tipoProprietario" = 'Indivíduo'
      WHERE "tipoProprietario" IS NULL
         OR "tipoProprietario" = ''
    `;

    console.log(`✓ ${individuosResult} indivíduos atualizados`);

    // Verify
    const total = await prisma.proprietario.count();
    const empresas = await prisma.proprietario.count({
      where: { tipoProprietario: 'Empresa' }
    });
    const individuos = await prisma.proprietario.count({
      where: { tipoProprietario: 'Indivíduo' }
    });

    console.log(`\n✅ Atualização completa!`);
    console.log(`Total: ${total}`);
    console.log(`Empresas: ${empresas}`);
    console.log(`Indivíduos: ${individuos}`);

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

updateProprietariosTipo();
