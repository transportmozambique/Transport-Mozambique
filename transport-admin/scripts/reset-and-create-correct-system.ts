import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 RESETANDO E CRIANDO SISTEMA CORRETO\n');
  console.log('='.repeat(80));

  // 1. Deletar tudo que foi criado
  console.log('\n🗑️  Deletando dados antigos...\n');
  
  await prisma.motorista.deleteMany({});
  console.log('✅ Motoristas deletados');
  
  await prisma.transporteProprietario.deleteMany({});
  console.log('✅ Relações transporte-proprietário deletadas');
  
  await prisma.transporte.deleteMany({ where: { matricula: { startsWith: 'AAA-' } } });
  console.log('✅ Transportes AAA deletados');
  
  await prisma.proprietario.deleteMany({ where: { bi: { startsWith: '4000000' } } });
  console.log('✅ Proprietários antigos deletados');

  // 2. Verificar se há via
  let via = await prisma.via.findFirst();
  if (!via) {
    const municipio = await prisma.municipio.upsert({
      where: { codigo: 'MUN001' },
      update: {},
      create: {
        nome: 'Maputo',
        codigo: 'MUN001',
        endereco: 'Maputo, Moçambique',
      }
    });

    via = await prisma.via.create({
      data: {
        nome: 'Maputo-Matola',
        codigo: 'V001',
        cor: '#3B82F6',
        terminalPartida: 'Maputo Centro',
        terminalChegada: 'Matola',
        geoLocationPath: '32.5892,-25.9655;32.6089,-25.9655',
        codigoMunicipio: 'MUN001',
        municipioId: municipio.id,
      }
    });
    console.log('\n✅ Via criada');
  }

  // 3. Criar 11 proprietários (empresas)
  console.log('\n🏢 Criando 11 empresas proprietárias...\n');
  
  const nomesEmpresas = [
    "Transportes Maputo Lda",
    "Via Rápida Transportes",
    "Expresso Matola",
    "Transportes Costa do Sol",
    "Machava Express",
    "Transportes Polana",
    "Via Verde Moçambique",
    "Transportes Sommerschield",
    "Expresso Marginal",
    "Transportes Baixa",
    "Via Azul Transportes",
  ];

  const proprietarios = [];
  
  for (let i = 0; i < 11; i++) {
    const prop = await prisma.proprietario.create({
      data: {
        nome: nomesEmpresas[i],
        bi: String(500000000 + i).padStart(9, '0'),
        nacionalidade: "Moçambicana",
        birthDate: new Date(1990 + i, 0, 1),
        endereco: `Av. Julius Nyerere, ${100 + (i * 50)}, Maputo`,
        contacto1: 21300000 + i,
        contacto2: 21400000 + i,
      }
    });
    proprietarios.push(prop);
    console.log(`✅ ${i + 1}/11 - ${prop.nome}`);
  }

  // 4. Criar 111 transportes com matrículas reais
  console.log('\n🚌 Criando 111 transportes com matrículas reais...\n');
  
  const prefixos = ['ACA', 'ACB', 'ACC', 'ACD', 'ACE', 'ACF', 'ACG', 'ACH', 'ACI', 'ACJ', 'ACK'];
  const marcas = ['Toyota', 'Mercedes', 'Volkswagen', 'Nissan', 'Isuzu', 'Mitsubishi', 'Hyundai'];
  const modelos = ['Hiace', 'Sprinter', 'Crafter', 'Urvan', 'NQR', 'Rosa', 'County'];
  const cores = ['Branco', 'Azul', 'Vermelho', 'Verde', 'Amarelo', 'Cinza', 'Preto'];

  const transportes = [];
  let transporteIndex = 0;

  for (let empresaIdx = 0; empresaIdx < 11; empresaIdx++) {
    const numTransportes = empresaIdx < 10 ? 10 : 11; // Última empresa tem 11 transportes
    const prefixo = prefixos[empresaIdx];

    for (let t = 0; t < numTransportes; t++) {
      transporteIndex++;
      const numero = String(t + 1).padStart(3, '0');
      const matricula = `${prefixo}-${numero}M`;
      
      const transporte = await prisma.transporte.create({
        data: {
          matricula,
          modelo: modelos[transporteIndex % modelos.length],
          marca: marcas[transporteIndex % marcas.length],
          cor: cores[transporteIndex % cores.length],
          lotacao: 15,
          codigo: transporteIndex,
          codigoVia: via.codigo,
          viaId: via.id,
          currGeoLocation: '32.5892,-25.9655',
        }
      });

      // Atribuir ao proprietário
      await prisma.transporteProprietario.create({
        data: {
          codigoTransporte: transporte.codigo,
          idProprietario: proprietarios[empresaIdx].id,
          transporteId: transporte.id,
          proprietarioId: proprietarios[empresaIdx].id,
        }
      });

      transportes.push(transporte);
      
      if (transporteIndex % 10 === 0) {
        console.log(`✅ ${transporteIndex}/111 transportes criados...`);
      }
    }
  }

  console.log(`✅ 111/111 transportes criados!`);

  // 5. Criar 111 motoristas
  console.log('\n👨‍✈️ Criando 111 motoristas...\n');
  
  const nomesMasculinos = [
    "João", "Pedro", "Carlos", "António", "Manuel", "Fernando", "Ricardo", "Paulo",
    "José", "Francisco", "Armando", "Alberto", "Domingos", "Joaquim", "Sebastião",
    "Tomás", "Miguel", "Rafael", "Daniel", "Gabriel", "Lucas", "Mateus", "André",
    "Bruno", "David", "Eduardo", "Felipe", "Gustavo", "Henrique", "Igor", "Jorge",
    "Leonardo", "Marcos", "Nelson", "Oscar", "Rui", "Samuel", "Tiago", "Vicente"
  ];

  const nomesFemininos = [
    "Maria", "Ana", "Isabel", "Rosa", "Beatriz", "Sofia", "Catarina", "Teresa",
    "Paula", "Carla", "Sandra", "Cristina", "Fernanda", "Helena", "Inês",
    "Joana", "Laura", "Mariana", "Patrícia", "Rita", "Sara", "Vera", "Alice",
    "Bárbara", "Diana", "Eduarda", "Fátima", "Graça", "Júlia", "Lúcia", "Marta",
    "Natália", "Olga", "Raquel", "Sílvia", "Tatiana", "Vitória", "Zélia"
  ];

  const apelidos = [
    "Silva", "Santos", "Costa", "Macamo", "Nhaca", "Sitoe", "Cossa", "Mondlane",
    "Chissano", "Guebuzza", "Machel", "Tembe", "Mabunda", "Chapo", "Nhamitambo",
    "Mahumane", "Bila", "Matlombe", "Massinga", "Nkomo", "Zandamela", "Maluleque",
    "Chicuamba", "Maposse", "Nhabinde", "Cumbe", "Muthisse", "Zavale", "Matusse",
    "Chongo", "Mabote", "Ngovene", "Macie", "Langa", "Mussagy", "Nkavele"
  ];

  function gerarNomeCompleto(genero: string, index: number): string {
    const primeiroNome = genero === "Masculino" 
      ? nomesMasculinos[index % nomesMasculinos.length]
      : nomesFemininos[index % nomesFemininos.length];
    
    const segundoNome = genero === "Masculino"
      ? nomesMasculinos[(index + 7) % nomesMasculinos.length]
      : nomesFemininos[(index + 7) % nomesFemininos.length];
    
    const apelido = apelidos[index % apelidos.length];
    
    return `${primeiroNome} ${segundoNome} ${apelido}`;
  }

  function gerarData(anosAtras: number, variacao: number = 0): Date {
    const hoje = new Date();
    const ano = hoje.getFullYear() - anosAtras + (variacao % 3);
    const mes = Math.floor(Math.random() * 12);
    const dia = Math.floor(Math.random() * 28) + 1;
    return new Date(ano, mes, dia);
  }

  for (let i = 0; i < 111; i++) {
    const genero = i % 3 === 0 ? "Feminino" : "Masculino";
    const nome = gerarNomeCompleto(genero, i);
    const estadosCivis = ["Solteiro", "Casado", "Divorciado", "Viúvo"];
    const categorias = ["B", "C", "D"];
    
    const dataEmissaoBI = gerarData(4, i);
    const dataEmissaoCarta = gerarData(5, i);
    
    await prisma.motorista.create({
      data: {
        nome,
        bi: String(110200000000 + i).padStart(12, '0') + String.fromCharCode(65 + (i % 26)),
        cartaConducao: `CC-${2016 + (i % 8)}-${String(i + 1).padStart(6, '0')}`,
        telefone: `+258 ${["84", "85", "86", "87"][i % 4]} ${String(100 + (i % 900)).padStart(3, '0')} ${String(1000 + (i * 7 % 9000)).padStart(4, '0')}`,
        email: `${nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(' ')[0]}.motorista${i + 1}@transport.co.mz`,
        dataNascimento: gerarData(35, i),
        endereco: `Av. ${apelidos[i % apelidos.length]}, ${100 + i}, Maputo`,
        foto: `https://randomuser.me/api/portraits/${genero === "Masculino" ? "men" : "women"}/${(i % 99) + 1}.jpg`,
        nacionalidade: "Moçambicana",
        genero,
        estadoCivil: estadosCivis[i % estadosCivis.length],
        numeroEmergencia: `+258 84 ${String(500 + i).padStart(3, '0')} ${String(2000 + i).padStart(4, '0')}`,
        contatoEmergencia: `${gerarNomeCompleto(genero === "Masculino" ? "Feminino" : "Masculino", i + 50)} (${genero === "Masculino" ? "Esposa" : "Marido"})`,
        deficiencia: null,
        dataEmissaoBI,
        dataValidadeBI: new Date(dataEmissaoBI.getFullYear() + 10, dataEmissaoBI.getMonth(), dataEmissaoBI.getDate()),
        dataEmissaoCarta,
        dataValidadeCarta: new Date(dataEmissaoCarta.getFullYear() + 10, dataEmissaoCarta.getMonth(), dataEmissaoCarta.getDate()),
        categoriaCarta: categorias[i % categorias.length],
        experienciaAnos: 3 + (i % 15),
        observacoes: i % 5 === 0 ? "Motorista experiente e pontual." : null,
        status: "ativo",
        transporteId: transportes[i].id,
      }
    });

    if ((i + 1) % 10 === 0) {
      console.log(`✅ ${i + 1}/111 motoristas criados...`);
    }
  }

  console.log(`✅ 111/111 motoristas criados!`);

  // Estatísticas finais
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 SISTEMA CRIADO COM SUCESSO!\n');
  console.log(`✅ 11 empresas proprietárias`);
  console.log(`✅ 111 transportes (matrículas: ACA-001M até ACK-011M)`);
  console.log(`✅ 111 motoristas com dados completos`);
  console.log(`✅ Cada empresa tem ~10 transportes`);
  console.log(`✅ Cada transporte tem 1 motorista`);
  console.log(`✅ Cada motorista tem foto realista\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
