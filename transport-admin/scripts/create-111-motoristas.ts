import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Nomes moçambicanos comuns
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
  "Chongo", "Mabote", "Ngovene", "Macie", "Langa", "Mussagy", "Nkavele",
  "Mahumane", "Chiconela", "Mabasso", "Nkuna", "Matusse", "Chauke", "Malate"
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

function gerarBI(index: number): string {
  const numero = String(110200000000 + index).padStart(12, '0');
  const letra = String.fromCharCode(65 + (index % 26)); // A-Z
  return `${numero}${letra}`;
}

function gerarCarta(index: number): string {
  const ano = 2016 + (index % 8); // 2016-2023
  const numero = String(index + 1).padStart(6, '0');
  return `CC-${ano}-${numero}`;
}

function gerarTelefone(index: number): string {
  const prefixos = ["84", "85", "86", "87"];
  const prefixo = prefixos[index % prefixos.length];
  const numero1 = String(100 + (index % 900)).padStart(3, '0');
  const numero2 = String(1000 + (index * 7 % 9000)).padStart(4, '0');
  return `+258 ${prefixo} ${numero1} ${numero2}`;
}

function gerarEmail(nome: string, index: number): string {
  const nomeSimples = nome.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(' ')[0];
  return `${nomeSimples}.motorista${index + 1}@transport.co.mz`;
}

function gerarData(anosAtras: number, variacao: number = 0): Date {
  const hoje = new Date();
  const ano = hoje.getFullYear() - anosAtras + (variacao % 3);
  const mes = Math.floor(Math.random() * 12);
  const dia = Math.floor(Math.random() * 28) + 1;
  return new Date(ano, mes, dia);
}

async function main() {
  console.log('🚀 Criando 111 motoristas...\n');

  // Buscar todos os transportes com seus proprietários
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

  console.log(`📊 Encontrados ${transportes.length} transportes\n`);

  // Verificar se há transportes suficientes
  if (transportes.length < 111) {
    console.log(`⚠️  AVISO: Existem apenas ${transportes.length} transportes, mas precisamos de 111.`);
    console.log(`⚠️  Alguns motoristas não serão atribuídos a transportes.\n`);
  }

  const totalMotoristas = 111; // Sempre criar exatamente 111 motoristas

  for (let i = 0; i < totalMotoristas; i++) {
    const genero = i % 3 === 0 ? "Feminino" : "Masculino"; // ~33% mulheres
    const nome = gerarNomeCompleto(genero, i);
    const estadosCivis = ["Solteiro", "Casado", "Divorciado", "Viúvo"];
    const categorias = ["B", "C", "D"];
    
    const dataEmissaoBI = gerarData(4, i);
    const dataEmissaoCarta = gerarData(5, i);
    
    const motorista = {
      nome,
      bi: gerarBI(i),
      cartaConducao: gerarCarta(i),
      telefone: gerarTelefone(i),
      email: gerarEmail(nome, i),
      dataNascimento: gerarData(35, i), // 35 anos atrás +/- variação
      endereco: `Av. ${apelidos[i % apelidos.length]}, ${100 + i}, Maputo`,
      foto: `https://randomuser.me/api/portraits/${genero === "Masculino" ? "men" : "women"}/${(i % 99) + 1}.jpg`,
      nacionalidade: "Moçambicana",
      genero,
      estadoCivil: estadosCivis[i % estadosCivis.length],
      numeroEmergencia: gerarTelefone(i + 1000),
      contatoEmergencia: `${gerarNomeCompleto(genero === "Masculino" ? "Feminino" : "Masculino", i + 50)} (${genero === "Masculino" ? "Esposa" : "Marido"})`,
      deficiencia: null,
      dataEmissaoBI,
      dataValidadeBI: new Date(dataEmissaoBI.getFullYear() + 10, dataEmissaoBI.getMonth(), dataEmissaoBI.getDate()),
      dataEmissaoCarta,
      dataValidadeCarta: new Date(dataEmissaoCarta.getFullYear() + 10, dataEmissaoCarta.getMonth(), dataEmissaoCarta.getDate()),
      categoriaCarta: categorias[i % categorias.length],
      experienciaAnos: 3 + (i % 15), // 3-17 anos
      observacoes: i % 5 === 0 ? "Motorista experiente e pontual." : null,
      status: "ativo",
      transporteId: i < transportes.length ? transportes[i].id : null,
    };

    try {
      const created = await prisma.motorista.upsert({
        where: { bi: motorista.bi },
        update: motorista,
        create: motorista,
      });
      
      let transporteInfo = " → Sem transporte";
      if (motorista.transporteId && i < transportes.length) {
        const empresaNome = transportes[i].proprietarios.length > 0 
          ? transportes[i].proprietarios[0].proprietario.nome 
          : "Sem empresa";
        transporteInfo = ` → Transporte: ${transportes[i].matricula} | Empresa: ${empresaNome}`;
      }
      
      console.log(`✅ ${i + 1}/111 - ${created.nome} (${genero})${transporteInfo}`);
    } catch (error: any) {
      console.error(`❌ Erro ao criar motorista ${nome}:`, error.message);
    }
  }

  console.log('\n✨ Criação de motoristas concluída!');
  console.log(`📊 Total: 111 motoristas criados`);
  console.log(`🚌 Motoristas atribuídos a transportes: ${Math.min(111, transportes.length)}`);
  console.log(`🏢 Transportes com empresas: ${transportes.filter(t => t.proprietarios.length > 0).length}`);
  console.log(`📸 Todos com fotos realistas de pessoas que não existem`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
