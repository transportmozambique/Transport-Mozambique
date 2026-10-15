const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addCertificates() {
  try {
    console.log('=== ADICIONANDO CERTIFICADOS ÀS EMPRESAS ===\n');

    // Get all empresas
    const empresas = await prisma.$queryRaw`
      SELECT id, nome
      FROM "Proprietario"
      WHERE "tipoProprietario" = 'Empresa'
      ORDER BY nome
    `;

    console.log(`Encontradas ${empresas.length} empresas:\n`);

    // URL de exemplo de certificado (pode ser substituído por URLs reais)
    const certificadoURL = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

    for (const empresa of empresas) {
      await prisma.$executeRaw`
        UPDATE "Proprietario"
        SET certificado = ${certificadoURL}
        WHERE id = ${empresa.id}
      `;

      console.log(`✓ ${empresa.nome} - Certificado adicionado`);
    }

    console.log(`\n✅ ${empresas.length} empresas atualizadas com certificados\n`);

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addCertificates();
