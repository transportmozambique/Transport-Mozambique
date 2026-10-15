import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const transportes = await prisma.transporte.count();
  const motoristas = await prisma.motorista.count();
  const proprietarios = await prisma.proprietario.count();
  
  console.log('📊 Estado atual da base de dados:');
  console.log(`   Transportes: ${transportes}`);
  console.log(`   Motoristas: ${motoristas}`);
  console.log(`   Proprietários: ${proprietarios}`);
  
  if (motoristas > 0) {
    const motoristasSample = await prisma.motorista.findFirst({
      include: {
        transporte: {
          include: {
            proprietarios: {
              include: {
                proprietario: true
              }
            }
          }
        }
      }
    });
    
    console.log('\n📋 Exemplo de motorista:');
    console.log(`   Nome: ${motoristasSample?.nome || 'N/A'}`);
    console.log(`   Transporte: ${motoristasSample?.transporte?.matricula || 'Não atribuído'}`);
    console.log(`   Empresa: ${motoristasSample?.transporte?.proprietarios[0]?.proprietario?.nome || 'Sem empresa'}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
