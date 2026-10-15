const { PrismaClient } = require('./transport-admin/node_modules/@prisma/client');

const prisma = new PrismaClient();

async function updateProprietariosTipo() {
  try {
    console.log('Atualizando proprietários com tipo...\n');

    // Get all proprietarios
    const proprietarios = await prisma.proprietario.findMany();

    for (const prop of proprietarios) {
      // Determinar tipo baseado no nome
      const isEmpresa = prop.nome.toLowerCase().includes('lda') || 
                        prop.nome.toLowerCase().includes('ltda') ||
                        prop.nome.toLowerCase().includes('transportes') ||
                        prop.nome.toLowerCase().includes('empresa') ||
                        prop.nome.toLowerCase().includes('sa') ||
                        prop.nome.toLowerCase().includes('sarl');

      const tipo = isEmpresa ? 'Empresa' : 'Indivíduo';

      await prisma.proprietario.update({
        where: { id: prop.id },
        data: { tipoProprietario: tipo }
      });

      console.log(`✓ ${prop.nome} -> ${tipo}`);
    }

    console.log(`\n✅ ${proprietarios.length} proprietários atualizados com sucesso!`);

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

updateProprietariosTipo();
