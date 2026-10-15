const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixProprietariosTipo() {
  try {
    console.log('Corrigindo tipos de proprietários...\n');

    // Get all proprietarios
    const proprietarios = await prisma.$queryRaw`
      SELECT id, nome, "tipoProprietario"
      FROM "Proprietario"
      ORDER BY nome
    `;

    console.log('=== PROPRIETÁRIOS ATUAIS ===\n');
    proprietarios.forEach((p, i) => {
      console.log(`${i + 1}. ${p.nome} - ${p.tipoProprietario}`);
    });

    // Nomes que são claramente empresas
    const empresasNomes = [
      'Expresso Marginal',
      'Expresso Matola',
      'Machava Express',
      'Via Verde Moçambique',
      'Transportes Maputo Lda',
      'TPM - Transportes Públicos de Maputo',
      'Oliveiras Transportes'
    ];

    console.log('\n=== ATUALIZANDO EMPRESAS ===\n');

    for (const nome of empresasNomes) {
      const result = await prisma.$executeRaw`
        UPDATE "Proprietario"
        SET "tipoProprietario" = 'Empresa'
        WHERE nome = ${nome}
      `;
      
      if (result > 0) {
        console.log(`✓ ${nome} -> Empresa`);
      }
    }

    // Verify final state
    const final = await prisma.$queryRaw`
      SELECT "tipoProprietario", COUNT(*) as total
      FROM "Proprietario"
      GROUP BY "tipoProprietario"
      ORDER BY "tipoProprietario"
    `;

    console.log('\n=== RESULTADO FINAL ===');
    final.forEach(f => {
      console.log(`${f.tipoProprietario}: ${f.total}`);
    });

    // Show all after update
    const updated = await prisma.$queryRaw`
      SELECT nome, "tipoProprietario"
      FROM "Proprietario"
      ORDER BY "tipoProprietario", nome
    `;

    console.log('\n=== LISTA COMPLETA ATUALIZADA ===\n');
    let currentTipo = '';
    updated.forEach((p) => {
      if (p.tipoProprietario !== currentTipo) {
        currentTipo = p.tipoProprietario;
        console.log(`\n--- ${currentTipo.toUpperCase()} ---`);
      }
      console.log(`  • ${p.nome}`);
    });

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixProprietariosTipo();
