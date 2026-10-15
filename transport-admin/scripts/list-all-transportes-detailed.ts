import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Listando TODOS os transportes em detalhe...\n');

  const transportes = await prisma.transporte.findMany({
    include: {
      via: true,
      motorista: true,
      proprietarios: {
        include: {
          proprietario: true
        }
      }
    },
    orderBy: { matricula: 'asc' }
  });

  console.log(`📊 Total: ${transportes.length} transportes\n`);
  console.log('=' .repeat(80));

  // Agrupar por prefixo de matrícula
  const grupos: { [key: string]: typeof transportes } = {};
  
  transportes.forEach(t => {
    const prefixo = t.matricula.split('-')[0];
    if (!grupos[prefixo]) {
      grupos[prefixo] = [];
    }
    grupos[prefixo].push(t);
  });

  console.log('\n📋 TRANSPORTES AGRUPADOS POR PREFIXO:\n');
  
  Object.keys(grupos).sort().forEach(prefixo => {
    const lista = grupos[prefixo];
    console.log(`\n${prefixo}-XXXX: ${lista.length} transportes`);
    console.log('-'.repeat(80));
    
    lista.slice(0, 5).forEach(t => {
      console.log(`  ${t.matricula} | ${t.marca} ${t.modelo} | Via: ${t.via?.nome || 'N/A'}`);
      console.log(`    Motorista: ${t.motorista?.nome || 'Não atribuído'}`);
      console.log(`    Empresa: ${t.proprietarios[0]?.proprietario?.nome || 'Sem empresa'}`);
    });
    
    if (lista.length > 5) {
      console.log(`  ... e mais ${lista.length - 5} transportes`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('\n📊 RESUMO POR PREFIXO:\n');
  
  Object.keys(grupos).sort().forEach(prefixo => {
    const lista = grupos[prefixo];
    const comMotorista = lista.filter(t => t.motorista).length;
    const comEmpresa = lista.filter(t => t.proprietarios.length > 0).length;
    
    console.log(`${prefixo}: ${lista.length} transportes | ${comMotorista} com motorista | ${comEmpresa} com empresa`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
