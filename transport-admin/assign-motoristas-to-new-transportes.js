const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚗 Atribuindo motoristas aos transportes...\n');

  // Step 1: Get transportes without motorista
  const transportesSemMotorista = await prisma.transporte.findMany({
    where: {
      motorista: null
    },
    orderBy: {
      codigo: 'asc'
    }
  });

  console.log(`📊 Transportes sem motorista: ${transportesSemMotorista.length}\n`);

  if (transportesSemMotorista.length === 0) {
    console.log('✅ Todos os transportes já têm motorista atribuído!');
    return;
  }

  // Step 2: Get existing motoristas
  const motoristasExistentes = await prisma.motorista.findMany({
    include: {
      transporte: true
    }
  });

  const motoristasDisponiveis = motoristasExistentes.filter(m => !m.transporte);
  
  console.log(`👨‍✈️ Motoristas existentes: ${motoristasExistentes.length}`);
  console.log(`   - Disponíveis: ${motoristasDisponiveis.length}`);
  console.log(`   - Já atribuídos: ${motoristasExistentes.length - motoristasDisponiveis.length}\n`);

  // Step 3: Create new motoristas if needed
  const motoristasNecessarios = transportesSemMotorista.length - motoristasDisponiveis.length;
  
  if (motoristasNecessarios > 0) {
    console.log(`🆕 Criando ${motoristasNecessarios} novos motoristas...\n`);

    const nomesPrimeiros = ['João', 'Pedro', 'Carlos', 'Manuel', 'António', 'José', 'Francisco', 'Paulo', 'Miguel', 'Fernando'];
    const nomesUltimos = ['Silva', 'Santos', 'Machado', 'Nhantumbo', 'Cossa', 'Mahumane', 'Sitoe', 'Bila', 'Chissano', 'Mondlane'];
    
    for (let i = 0; i < motoristasNecessarios; i++) {
      const numero = motoristasExistentes.length + i + 1;
      const primeiroNome = nomesPrimeiros[i % nomesPrimeiros.length];
      const ultimoNome = nomesUltimos[Math.floor(i / nomesPrimeiros.length) % nomesUltimos.length];
      const nome = `${primeiroNome} ${ultimoNome}`;
      
      const motorista = await prisma.motorista.create({
        data: {
          nome: nome,
          bi: `${String(110000000 + numero).padStart(12, '0')}A`,
          carta: `MOZ${String(1000 + numero).padStart(6, '0')}`,
          contacto1: 840000000 + numero,
          nacionalidade: 'Moçambicana',
          morada: 'Maputo',
          estadoCivil: 'Solteiro',
          genero: 'Masculino',
        }
      });

      motoristasDisponiveis.push(motorista);

      if ((i + 1) % 10 === 0) {
        console.log(`   Criados ${i + 1}/${motoristasNecessarios} motoristas...`);
      }
    }

    console.log(`✅ ${motoristasNecessarios} novos motoristas criados\n`);
  }

  // Step 4: Assign motoristas to transportes
  console.log(`🔗 Atribuindo motoristas aos transportes...\n`);

  let atribuidos = 0;
  for (let i = 0; i < transportesSemMotorista.length; i++) {
    const transporte = transportesSemMotorista[i];
    const motorista = motoristasDisponiveis[i];

    await prisma.motorista.update({
      where: { id: motorista.id },
      data: { transporteId: transporte.id }
    });

    atribuidos++;

    if ((i + 1) % 10 === 0) {
      console.log(`   Atribuídos ${i + 1}/${transportesSemMotorista.length} motoristas...`);
    }
  }

  console.log(`✅ ${atribuidos} motoristas atribuídos\n`);

  // Step 5: Final verification
  const transportesComMotorista = await prisma.transporte.findMany({
    where: {
      motorista: {
        isNot: null
      }
    }
  });

  const transportesSemMotoristaFinal = await prisma.transporte.findMany({
    where: {
      motorista: null
    }
  });

  const totalTransportes = await prisma.transporte.count();
  const totalMotoristas = await prisma.motorista.count();

  console.log(`📊 Estado final:`);
  console.log(`   Total transportes: ${totalTransportes}`);
  console.log(`   - Com motorista: ${transportesComMotorista.length}`);
  console.log(`   - Sem motorista: ${transportesSemMotoristaFinal.length}`);
  console.log(`   Total motoristas: ${totalMotoristas}`);

  if (transportesSemMotoristaFinal.length === 0) {
    console.log(`\n✅ Todos os transportes têm motorista atribuído!`);
  } else {
    console.log(`\n⚠️  Ainda há ${transportesSemMotoristaFinal.length} transportes sem motorista`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
