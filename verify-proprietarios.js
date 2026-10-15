const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyProprietarios() {
  try {
    // Use raw SQL to verify
    const result = await prisma.$queryRaw`
      SELECT 
        id,
        nome,
        bi,
        nacionalidade,
        "birthDate",
        endereco,
        contacto1,
        contacto2,
        "tipoProprietario",
        "createdAt"
      FROM "Proprietario"
      LIMIT 5
    `;

    console.log('\n=== PROPRIETÁRIOS NO BANCO DE DADOS ===\n');
    result.forEach((prop, index) => {
      console.log(`${index + 1}. ${prop.nome}`);
      console.log(`   Tipo: ${prop.tipoProprietario}`);
      console.log(`   BI: ${prop.bi}`);
      console.log(`   Nacionalidade: ${prop.nacionalidade}`);
      console.log(`   Endereço: ${prop.endereco}`);
      console.log(`   Contacto: ${prop.contacto1}`);
      console.log(`   Data Nascimento: ${prop.birthDate}`);
      console.log('');
    });

    // Count by type
    const counts = await prisma.$queryRaw`
      SELECT 
        "tipoProprietario",
        COUNT(*) as total
      FROM "Proprietario"
      GROUP BY "tipoProprietario"
    `;

    console.log('=== TOTAIS POR TIPO ===');
    counts.forEach(c => {
      console.log(`${c.tipoProprietario}: ${c.total}`);
    });

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyProprietarios();
