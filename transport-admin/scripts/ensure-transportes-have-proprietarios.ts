import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Nomes de empresas moçambicanas
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
  "Transportes Malhangalene",
  "Expresso Maxaquene",
  "Transportes Xipamanine",
  "Via Rápida Matola",
  "Transportes Benfica",
  "Expresso Zimpeto",
  "Transportes Mavalane",
  "Via Sul Transportes",
  "Transportes Laulane",
  "Expresso Albazine",
  "Transportes Hulene",
  "Via Norte Moçambique",
  "Transportes Chamanculo",
  "Expresso Inhaca",
  "Transportes Catembe",
  "Via Marítima Transportes",
  "Transportes KaTembe",
  "Expresso Boane",
  "Transportes Marracuene",
  "Via Central Moçambique",
  "Transportes Manhiça",
  "Expresso Xinavane",
  "Transportes Magude",
  "Via Leste Transportes",
  "Transportes Moamba",
  "Expresso Namaacha",
  "Transportes Bela Vista",
  "Via Oeste Moçambique",
  "Transportes Julius Nyerere",
];

function gerarNomeEmpresa(index: number): string {
  if (index < nomesEmpresas.length) {
    return nomesEmpresas[index];
  }
  // Se precisar de mais empresas, gerar nomes genéricos
  return `Transportes ${String.fromCharCode(65 + (index % 26))} Moçambique Lda`;
}

function gerarBIEmpresa(index: number): string {
  // NUIT (Número Único de Identificação Tributária) para empresas
  const numero = String(400000000 + index).padStart(9, '0');
  return numero;
}

function gerarContactoEmpresa(index: number): number {
  // Números de telefone fixo para empresas
  const numero = 21300000 + index;
  return numero;
}

function gerarEnderecoEmpresa(index: number): string {
  const ruas = [
    "Av. Julius Nyerere",
    "Av. 24 de Julho",
    "Av. Vladimir Lenine",
    "Av. Eduardo Mondlane",
    "Av. Samora Machel",
    "Av. Mao Tse Tung",
    "Av. Acordos de Lusaka",
    "Av. Marginal",
    "Av. Friedrich Engels",
    "Av. Karl Marx",
  ];
  
  const rua = ruas[index % ruas.length];
  const numero = 100 + (index * 10);
  return `${rua}, ${numero}, Maputo`;
}

async function main() {
  console.log('🏢 Verificando proprietários dos transportes...\n');

  // Buscar todos os transportes
  const transportes = await prisma.transporte.findMany({
    include: {
      proprietarios: {
        include: {
          proprietario: true
        }
      }
    },
    orderBy: { codigo: 'asc' }
  });

  console.log(`📊 Total de transportes: ${transportes.length}`);
  
  const transportesSemProprietario = transportes.filter(t => t.proprietarios.length === 0);
  console.log(`⚠️  Transportes sem proprietário: ${transportesSemProprietario.length}\n`);

  if (transportesSemProprietario.length === 0) {
    console.log('✅ Todos os transportes já têm proprietários!');
    return;
  }

  console.log('🚀 Criando proprietários para transportes sem empresa...\n');

  let proprietariosCriados = 0;
  let atribuicoes = 0;

  for (let i = 0; i < transportesSemProprietario.length; i++) {
    const transporte = transportesSemProprietario[i];
    const bi = gerarBIEmpresa(i);

    try {
      // Verificar se já existe um proprietário com este BI
      let proprietario = await prisma.proprietario.findUnique({
        where: { bi }
      });

      // Se não existir, criar novo proprietário
      if (!proprietario) {
        proprietario = await prisma.proprietario.create({
          data: {
            nome: gerarNomeEmpresa(i),
            bi: bi,
            nacionalidade: "Moçambicana",
            birthDate: new Date(1990 + (i % 30), 0, 1), // Empresas "fundadas" entre 1990-2020
            endereco: gerarEnderecoEmpresa(i),
            contacto1: gerarContactoEmpresa(i),
            contacto2: gerarContactoEmpresa(i) + 1000,
          }
        });
        proprietariosCriados++;
        console.log(`✅ Empresa criada: ${proprietario.nome}`);
      }

      // Atribuir proprietário ao transporte
      await prisma.transporteProprietario.create({
        data: {
          codigoTransporte: transporte.codigo,
          idProprietario: proprietario.id,
          transporteId: transporte.id,
          proprietarioId: proprietario.id,
        }
      });

      atribuicoes++;
      console.log(`   → Atribuído ao transporte: ${transporte.matricula}`);

    } catch (error: any) {
      console.error(`❌ Erro ao processar transporte ${transporte.matricula}:`, error.message);
    }
  }

  console.log('\n✨ Processo concluído!');
  console.log(`📊 Proprietários criados: ${proprietariosCriados}`);
  console.log(`🔗 Atribuições realizadas: ${atribuicoes}`);
  console.log(`✅ Todos os transportes agora têm empresas proprietárias!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
