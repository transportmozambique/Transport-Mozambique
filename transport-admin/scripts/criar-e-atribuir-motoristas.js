const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Nomes moçambicanos comuns
const nomes = [
  'João Manuel', 'Maria Santos', 'Carlos Alberto', 'Ana Paula', 'Pedro Miguel',
  'Luísa Fernanda', 'António José', 'Beatriz Silva', 'Francisco Xavier', 'Isabel Maria',
  'Manuel Fernando', 'Rosa Amélia', 'José Carlos', 'Teresa Cristina', 'Paulo Roberto',
  'Mariana Costa', 'Ricardo Nunes', 'Catarina Lopes', 'Miguel Ângelo', 'Sofia Helena',
  'Daniel Augusto', 'Patrícia Gomes', 'Rafael Santos', 'Juliana Pereira', 'Bruno Henrique',
  'Carla Fernandes', 'Tiago Rodrigues', 'Vanessa Alves', 'André Luís', 'Cristina Martins',
  'Fernando Silva', 'Mónica Ribeiro', 'Rui Pedro', 'Sandra Costa', 'Vítor Manuel',
  'Cláudia Sousa', 'Nuno Miguel', 'Sílvia Oliveira', 'Hugo Alexandre', 'Diana Ferreira',
  'Sérgio Paulo', 'Liliana Santos', 'Fábio José', 'Andreia Lopes', 'Gonçalo Martins',
  'Inês Maria', 'Diogo Filipe', 'Raquel Gomes', 'Rodrigo Silva', 'Marta Cristina',
  'Simão Pedro', 'Joana Marques', 'Tomás Miguel', 'Vera Lúcia', 'Lucas Gabriel',
  'Susana Pinto', 'Marcos António', 'Elisa Rodrigues', 'Renato Carlos', 'Paula Fernanda',
  'Ivo Manuel', 'Célia Maria', 'Hélder José', 'Anabela Costa', 'Armando Silva',
  'Fernanda Santos', 'Joaquim Manuel', 'Graça Maria', 'Alberto Carlos', 'Lurdes Fernanda',
  'Domingos José', 'Conceição Maria', 'Alfredo Manuel', 'Piedade Santos', 'Sebastião Carlos',
  'Esperança Maria', 'Agostinho José', 'Fátima Cristina', 'Bernardino Manuel', 'Glória Santos',
  'Casimiro José', 'Hermínia Maria', 'Eusébio Manuel', 'Judite Santos', 'Felisberto Carlos',
  'Laurinda Maria', 'Guilherme José', 'Palmira Santos', 'Horácio Manuel', 'Quitéria Maria',
  'Inocêncio José', 'Rosalina Santos', 'Jacinto Manuel', 'Salomé Maria', 'Leopoldo José',
  'Teodora Santos', 'Marcelino Manuel', 'Ursulina Maria', 'Narciso José', 'Virgínia Santos',
  'Osvaldo Manuel', 'Zulmira Maria', 'Pascoal José', 'Adelina Santos', 'Quintino Manuel'
];

const apelidos = [
  'Nhaca', 'Macamo', 'Chissano', 'Mondlane', 'Machel', 'Cossa', 'Sitoe', 'Mahumane',
  'Bila', 'Chaúque', 'Tembe', 'Mabunda', 'Nkomo', 'Guambe', 'Malate', 'Nhabinde',
  'Massinga', 'Matlombe', 'Ngovene', 'Zitha', 'Matusse', 'Chilundo', 'Mavie', 'Nkavele'
];

function gerarNomeCompleto() {
  const nome = nomes[Math.floor(Math.random() * nomes.length)];
  const apelido = apelidos[Math.floor(Math.random() * apelidos.length)];
  return `${nome} ${apelido}`;
}

function gerarBI() {
  const numero = Math.floor(100000000000 + Math.random() * 900000000000);
  const letra = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return `${numero}${letra}`;
}

function gerarCartaConducao() {
  const ano = 2020 + Math.floor(Math.random() * 5);
  const numero = String(Math.floor(100000 + Math.random() * 900000)).padStart(6, '0');
  return `CC-${ano}-${numero}`;
}

function gerarTelefone() {
  const prefixos = ['84', '85', '86', '87'];
  const prefixo = prefixos[Math.floor(Math.random() * prefixos.length)];
  const numero = String(Math.floor(1000000 + Math.random() * 9000000)).padStart(7, '0');
  return `+258 ${prefixo} ${numero.substring(0, 3)} ${numero.substring(3)}`;
}

function gerarEmail(nome) {
  const nomeEmail = nome.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '.');
  return `${nomeEmail}@motorista.co.mz`;
}

function gerarDataNascimento() {
  const ano = 1970 + Math.floor(Math.random() * 30); // Entre 1970 e 2000
  const mes = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  const dia = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
  return new Date(`${ano}-${mes}-${dia}`);
}

const enderecos = [
  'Av. Julius Nyerere, Maputo',
  'Av. Eduardo Mondlane, Maputo',
  'Av. Mao Tse Tung, Maputo',
  'Av. Vladimir Lenine, Maputo',
  'Av. 24 de Julho, Maputo',
  'Av. Acordos de Lusaka, Maputo',
  'Av. Samora Machel, Matola',
  'Av. da Independência, Matola',
  'Rua da Resistência, Maputo',
  'Rua dos Continuadores, Maputo',
  'Av. Marginal, Maputo',
  'Av. Friedrich Engels, Maputo',
  'Av. Karl Marx, Maputo',
  'Av. Ahmed Sekou Touré, Maputo',
  'Av. Patrice Lumumba, Maputo'
];

function gerarEndereco() {
  return enderecos[Math.floor(Math.random() * enderecos.length)];
}

async function criarEAtribuirMotoristas() {
  console.log('🚀 Iniciando criação e atribuição automática de motoristas...\n');

  try {
    // 1. Verificar quantos transportes sem motorista existem
    const transportesSemMotorista = await prisma.transporte.findMany({
      where: { motorista: null },
      orderBy: { codigo: 'asc' }
    });

    console.log(`📊 Encontrados ${transportesSemMotorista.length} transportes sem motorista`);

    if (transportesSemMotorista.length === 0) {
      console.log('✅ Todos os transportes já têm motorista atribuído!\n');
      return;
    }

    // 2. Verificar motoristas disponíveis
    const motoristasDisponiveis = await prisma.motorista.count({
      where: {
        status: 'ativo',
        transporteId: null
      }
    });

    console.log(`👤 Motoristas disponíveis: ${motoristasDisponiveis}`);

    const motoristasNecessarios = transportesSemMotorista.length - motoristasDisponiveis;

    if (motoristasNecessarios > 0) {
      console.log(`\n🔧 Criando ${motoristasNecessarios} novos motoristas...\n`);
      console.log('─'.repeat(80));

      // 3. Criar novos motoristas
      const motoristasExistentes = await prisma.motorista.findMany({
        select: { bi: true, cartaConducao: true, email: true }
      });

      const bisExistentes = new Set(motoristasExistentes.map(m => m.bi));
      const cartasExistentes = new Set(motoristasExistentes.map(m => m.cartaConducao));
      const emailsExistentes = new Set(motoristasExistentes.map(m => m.email));

      for (let i = 0; i < motoristasNecessarios; i++) {
        let nome, bi, carta, email;
        let tentativas = 0;

        // Gerar dados únicos
        do {
          nome = gerarNomeCompleto();
          bi = gerarBI();
          carta = gerarCartaConducao();
          email = gerarEmail(nome);
          tentativas++;
        } while (
          (bisExistentes.has(bi) || cartasExistentes.has(carta) || emailsExistentes.has(email)) &&
          tentativas < 100
        );

        try {
          const motorista = await prisma.motorista.create({
            data: {
              nome,
              bi,
              cartaConducao: carta,
              telefone: gerarTelefone(),
              email,
              dataNascimento: gerarDataNascimento(),
              endereco: gerarEndereco(),
              status: 'ativo'
            }
          });

          bisExistentes.add(bi);
          cartasExistentes.add(carta);
          emailsExistentes.add(email);

          console.log(`✓ ${String(i + 1).padStart(3)}/${motoristasNecessarios} | ${nome.padEnd(35)} | ${bi}`);
        } catch (error) {
          console.log(`✗ ${String(i + 1).padStart(3)}/${motoristasNecessarios} | Erro ao criar motorista`);
        }
      }

      console.log('─'.repeat(80));
      console.log(`\n✅ ${motoristasNecessarios} motoristas criados com sucesso!\n`);
    }

    // 4. Atribuir motoristas aos transportes
    console.log('🔄 Atribuindo motoristas aos transportes...\n');
    console.log('─'.repeat(80));

    const todosMotoristas = await prisma.motorista.findMany({
      where: {
        status: 'ativo',
        transporteId: null
      },
      orderBy: { nome: 'asc' }
    });

    const todosTransportes = await prisma.transporte.findMany({
      where: { motorista: null },
      include: {
        via: { select: { nome: true } }
      },
      orderBy: { codigo: 'asc' }
    });

    let sucessos = 0;
    let erros = 0;

    for (let i = 0; i < Math.min(todosTransportes.length, todosMotoristas.length); i++) {
      const transporte = todosTransportes[i];
      const motorista = todosMotoristas[i];

      try {
        await prisma.motorista.update({
          where: { id: motorista.id },
          data: { transporteId: transporte.id }
        });

        const nomeMotorista = motorista.nome.padEnd(35);
        const matricula = transporte.matricula.padEnd(12);
        const via = transporte.via.nome.substring(0, 25);

        console.log(`✓ ${String(i + 1).padStart(3)}/${todosTransportes.length} | ${nomeMotorista} → ${matricula} | ${via}`);
        sucessos++;
      } catch (error) {
        console.log(`✗ ${String(i + 1).padStart(3)}/${todosTransportes.length} | Erro: ${motorista.nome} → ${transporte.matricula}`);
        erros++;
      }
    }

    console.log('─'.repeat(80));

    // 5. Estatísticas finais
    const stats = {
      totalTransportes: await prisma.transporte.count(),
      transportesComMotorista: await prisma.transporte.count({
        where: { motorista: { isNot: null } }
      }),
      transportesSemMotorista: await prisma.transporte.count({
        where: { motorista: null }
      }),
      totalMotoristas: await prisma.motorista.count(),
      motoristasAtivos: await prisma.motorista.count({
        where: { status: 'ativo' }
      }),
      motoristasComTransporte: await prisma.motorista.count({
        where: { transporteId: { not: null } }
      }),
      motoristasDisponiveis: await prisma.motorista.count({
        where: {
          status: 'ativo',
          transporteId: null
        }
      })
    };

    console.log('\n📈 Resumo da Atribuição:');
    console.log(`   ✅ Atribuições bem-sucedidas: ${sucessos}`);
    console.log(`   ❌ Erros: ${erros}`);

    console.log('\n📊 Estatísticas Finais:');
    console.log(`   🚌 Total de transportes: ${stats.totalTransportes}`);
    console.log(`   🚌 Transportes com motorista: ${stats.transportesComMotorista} (${Math.round(stats.transportesComMotorista / stats.totalTransportes * 100)}%)`);
    console.log(`   🚌 Transportes sem motorista: ${stats.transportesSemMotorista}`);
    console.log(`   👤 Total de motoristas: ${stats.totalMotoristas}`);
    console.log(`   👤 Motoristas ativos: ${stats.motoristasAtivos}`);
    console.log(`   👤 Motoristas com transporte: ${stats.motoristasComTransporte}`);
    console.log(`   👤 Motoristas disponíveis: ${stats.motoristasDisponiveis}`);

    if (stats.transportesSemMotorista === 0) {
      console.log('\n🎉 Parabéns! Todos os transportes agora têm motorista atribuído!');
    } else {
      console.log(`\n⚠️  Ainda há ${stats.transportesSemMotorista} transportes sem motorista.`);
    }

    console.log('\n✅ Processo concluído com sucesso!\n');

  } catch (error) {
    console.error('❌ Erro durante o processo:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o script
criarEAtribuirMotoristas()
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
