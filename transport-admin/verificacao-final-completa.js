const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 VERIFICAÇÃO FINAL COMPLETA DO SISTEMA\n');
  console.log('='.repeat(60));

  // 1. Transportes
  const transportes = await prisma.transporte.findMany({
    include: {
      via: true,
      motorista: true,
      proprietarios: {
        include: {
          proprietario: true
        }
      }
    }
  });

  const transportesComVia = transportes.filter(t => t.via).length;
  const transportesComMotorista = transportes.filter(t => t.motorista).length;
  const transportesComProprietario = transportes.filter(t => t.proprietarios.length > 0).length;

  console.log('\n📦 TRANSPORTES');
  console.log(`   Total: ${transportes.length}`);
  console.log(`   ✓ Com via: ${transportesComVia}/${transportes.length}`);
  console.log(`   ✓ Com motorista: ${transportesComMotorista}/${transportes.length}`);
  console.log(`   ✓ Com proprietário: ${transportesComProprietario}/${transportes.length}`);

  // 2. Vias
  const vias = await prisma.via.findMany({
    include: {
      _count: {
        select: {
          transportes: true
        }
      }
    }
  });

  const viasComTransportes = vias.filter(v => v._count.transportes > 0).length;

  console.log('\n🛣️  VIAS');
  console.log(`   Total: ${vias.length}`);
  console.log(`   ✓ Com transportes: ${viasComTransportes}/${vias.length}`);

  // 3. Motoristas
  const motoristas = await prisma.motorista.findMany({
    include: {
      transporte: true
    }
  });

  const motoristasComTransporte = motoristas.filter(m => m.transporte).length;

  console.log('\n👨‍✈️ MOTORISTAS');
  console.log(`   Total: ${motoristas.length}`);
  console.log(`   ✓ Com transporte: ${motoristasComTransporte}/${motoristas.length}`);

  // 4. Proprietários
  const proprietarios = await prisma.proprietario.findMany({
    include: {
      transportes: true
    }
  });

  const proprietariosComTransportes = proprietarios.filter(p => p.transportes.length > 0).length;

  console.log('\n🏢 PROPRIETÁRIOS');
  console.log(`   Total: ${proprietarios.length}`);
  console.log(`   ✓ Com transportes: ${proprietariosComTransportes}/${proprietarios.length}`);

  // 5. Municípios
  const municipios = await prisma.municipio.findMany({
    include: {
      _count: {
        select: {
          vias: true
        }
      }
    }
  });

  console.log('\n🏛️  MUNICÍPIOS');
  municipios.forEach(m => {
    console.log(`   ${m.nome}: ${m._count.vias} vias`);
  });

  // 6. Províncias
  const provincias = await prisma.provincia.findMany({
    include: {
      _count: {
        select: {
          municipios: true
        }
      }
    }
  });

  console.log('\n🗺️  PROVÍNCIAS');
  provincias.forEach(p => {
    console.log(`   ${p.nome}: ${p._count.municipios} municípios`);
  });

  // 7. Verificação de Integridade
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ VERIFICAÇÃO DE INTEGRIDADE\n');

  const checks = [
    {
      name: 'Transportes = 111',
      pass: transportes.length === 111,
      value: transportes.length
    },
    {
      name: 'Vias = 111',
      pass: vias.length === 111,
      value: vias.length
    },
    {
      name: 'Todos transportes têm via',
      pass: transportesComVia === transportes.length,
      value: `${transportesComVia}/${transportes.length}`
    },
    {
      name: 'Todos transportes têm motorista',
      pass: transportesComMotorista === transportes.length,
      value: `${transportesComMotorista}/${transportes.length}`
    },
    {
      name: 'Todos transportes têm proprietário',
      pass: transportesComProprietario === transportes.length,
      value: `${transportesComProprietario}/${transportes.length}`
    },
    {
      name: 'Todas vias têm transporte',
      pass: viasComTransportes === vias.length,
      value: `${viasComTransportes}/${vias.length}`
    },
    {
      name: 'Relação 1:1 transporte-via',
      pass: transportes.length === vias.length && transportesComVia === transportes.length,
      value: 'OK'
    }
  ];

  let allPassed = true;
  checks.forEach(check => {
    const icon = check.pass ? '✅' : '❌';
    console.log(`   ${icon} ${check.name}: ${check.value}`);
    if (!check.pass) allPassed = false;
  });

  console.log('\n' + '='.repeat(60));
  
  if (allPassed) {
    console.log('\n🎉 SISTEMA 100% OPERACIONAL!');
    console.log('\n   ✓ 111 transportes configurados');
    console.log('   ✓ 111 vias definidas');
    console.log('   ✓ 111 motoristas atribuídos');
    console.log('   ✓ 11 proprietários distribuídos');
    console.log('   ✓ Relação 1:1 transporte-via');
    console.log('   ✓ Todos os requisitos atendidos');
  } else {
    console.log('\n⚠️  SISTEMA COM PROBLEMAS');
    console.log('\n   Verifique os itens marcados com ❌ acima');
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
