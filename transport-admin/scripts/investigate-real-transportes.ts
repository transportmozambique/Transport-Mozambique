import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Investigando transportes reais...\n');

  // Buscar TODOS os transportes
  const allTransportes = await prisma.transporte.findMany({
    include: {
      via: true,
      motorista: true,
      proprietarios: {
        include: {
          proprietario: true
        }
      }
    },
    orderBy: { codigo: 'asc' }
  });

  console.log(`📊 Total de transportes na base de dados: ${allTransportes.length}\n`);

  // Separar por matrícula
  const transportesAAA = allTransportes.filter(t => t.matricula.startsWith('AAA-'));
  const transportesReais = allTransportes.filter(t => !t.matricula.startsWith('AAA-'));

  console.log(`🚌 Transportes com matrícula AAA (criados por script): ${transportesAAA.length}`);
  console.log(`🚌 Transportes reais (outros): ${transportesReais.length}\n`);

  if (transportesReais.length > 0) {
    console.log('📋 TRANSPORTES REAIS:\n');
    transportesReais.forEach((t, index) => {
      const motorista = t.motorista ? `Motorista: ${t.motorista.nome}` : 'Sem motorista';
      const empresa = t.proprietarios.length > 0 ? `Empresa: ${t.proprietarios[0].proprietario.nome}` : 'Sem empresa';
      const via = t.via ? `Via: ${t.via.nome}` : 'Sem via';
      
      console.log(`${index + 1}. ${t.matricula} (${t.marca} ${t.modelo})`);
      console.log(`   ${via}`);
      console.log(`   ${motorista}`);
      console.log(`   ${empresa}\n`);
    });
  }

  // Estatísticas
  const transportesReaisComMotorista = transportesReais.filter(t => t.motorista).length;
  const transportesReaisComEmpresa = transportesReais.filter(t => t.proprietarios.length > 0).length;

  console.log('📊 ESTATÍSTICAS DOS TRANSPORTES REAIS:');
  console.log(`   Total: ${transportesReais.length}`);
  console.log(`   Com motorista: ${transportesReaisComMotorista}`);
  console.log(`   Sem motorista: ${transportesReais.length - transportesReaisComMotorista}`);
  console.log(`   Com empresa: ${transportesReaisComEmpresa}`);
  console.log(`   Sem empresa: ${transportesReais.length - transportesReaisComEmpresa}\n`);

  // Verificar motoristas
  const motoristas = await prisma.motorista.findMany({
    include: {
      transporte: true
    }
  });

  const motoristasComTransporteAAA = motoristas.filter(m => m.transporte?.matricula.startsWith('AAA-')).length;
  const motoristasComTransporteReal = motoristas.filter(m => m.transporte && !m.transporte.matricula.startsWith('AAA-')).length;
  const motoristasSemTransporte = motoristas.filter(m => !m.transporte).length;

  console.log('📊 ESTATÍSTICAS DOS MOTORISTAS:');
  console.log(`   Total: ${motoristas.length}`);
  console.log(`   Com transporte AAA: ${motoristasComTransporteAAA}`);
  console.log(`   Com transporte real: ${motoristasComTransporteReal}`);
  console.log(`   Sem transporte: ${motoristasSemTransporte}\n`);

  console.log('💡 RECOMENDAÇÃO:');
  if (transportesReais.length >= 111) {
    console.log('   ✅ Existem transportes reais suficientes (111+)');
    console.log('   → Deletar transportes AAA');
    console.log('   → Reatribuir motoristas aos transportes reais');
    console.log('   → Garantir que transportes reais têm empresas\n');
  } else {
    console.log(`   ⚠️  Existem apenas ${transportesReais.length} transportes reais`);
    console.log('   → Manter alguns transportes AAA para completar 111');
    console.log('   → Priorizar transportes reais para motoristas\n');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
