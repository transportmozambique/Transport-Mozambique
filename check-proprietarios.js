const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProprietarios() {
  try {
    console.log('🔍 Verificando proprietários no banco de dados...\n');

    // Buscar todos os proprietários
    const proprietarios = await prisma.proprietario.findMany({
      include: {
        transportes: {
          include: {
            transporte: {
              select: {
                matricula: true,
              }
            }
          }
        }
      }
    });

    if (proprietarios.length === 0) {
      console.log('❌ Nenhum proprietário encontrado!');
      console.log('\n💡 Dica: Execute o script create-proprietarios.js para criar proprietários.');
      return;
    }

    console.log(`✅ Total de proprietários: ${proprietarios.length}\n`);
    console.log('📋 Lista de Proprietários:\n');

    proprietarios.forEach((p, index) => {
      console.log(`${index + 1}. ${p.nome}`);
      console.log(`   📞 ${p.telefone}`);
      console.log(`   ✉️  ${p.email}`);
      console.log(`   🚌 Autocarros: ${p.transportes.length}`);
      
      if (p.transportes.length > 0) {
        p.transportes.forEach(t => {
          console.log(`      - ${t.transporte.matricula}`);
        });
      }
      console.log('');
    });

    // Estatísticas
    const totalAutocarros = proprietarios.reduce((sum, p) => sum + p.transportes.length, 0);
    const mediaAutocarros = proprietarios.length > 0 ? (totalAutocarros / proprietarios.length).toFixed(1) : 0;

    console.log('📊 Estatísticas:');
    console.log(`   - Total de proprietários: ${proprietarios.length}`);
    console.log(`   - Total de autocarros atribuídos: ${totalAutocarros}`);
    console.log(`   - Média de autocarros por proprietário: ${mediaAutocarros}`);

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProprietarios();
