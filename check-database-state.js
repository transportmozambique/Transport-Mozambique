const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('=== VERIFICANDO ESTADO DO BANCO DE DADOS ===\n');

    const transportes = await prisma.transporte.count();
    const vias = await prisma.via.count();
    const paragens = await prisma.paragem.count();
    const motoristas = await prisma.motorista.count();
    const proprietarios = await prisma.proprietario.count();

    console.log('Transportes:', transportes);
    console.log('Vias:', vias);
    console.log('Paragens:', paragens);
    console.log('Motoristas:', motoristas);
    console.log('Proprietários:', proprietarios);

    if (transportes === 0 || vias === 0 || paragens === 0 || motoristas === 0) {
      console.log('\n⚠️  ATENÇÃO: Dados foram perdidos no reset do banco de dados!');
      console.log('Você precisa executar o seed novamente para recriar os dados.');
      console.log('\nExecute: node seed-all-data.js');
    } else {
      console.log('\n✅ Todos os dados estão presentes!');
    }

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
