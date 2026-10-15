import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Corrigindo dados dos motoristas...\n');

  // Verificar estado atual
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

  const motoristas = await prisma.motorista.findMany();

  console.log(`📊 Estado atual:`);
  console.log(`   Transportes: ${transportes.length}`);
  console.log(`   Motoristas: ${motoristas.length}`);
  console.log(`   Transportes com proprietário: ${transportes.filter(t => t.proprietarios.length > 0).length}\n`);

  // Deletar motoristas existentes (incompletos)
  console.log('🗑️  Deletando motoristas incompletos...');
  const deleted = await prisma.motorista.deleteMany({});
  console.log(`✅ ${deleted.count} motoristas deletados\n`);

  if (transportes.length === 0) {
    console.log('⚠️  Não há transportes! Por favor, crie transportes primeiro.');
    return;
  }

  console.log('🚀 Recriando motoristas com dados completos...\n');

  // Importar a lógica do script original
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
    const letra = String.fromCharCode(65 + (index % 26));
    return `${numero}${letra}`;
  }

  function gerarCarta(index: number): string {
    const ano = 2016 + (index % 8);
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

  const totalMotoristas = Math.min(111, transportes.length);

  for (let i = 0; i < totalMotoristas; i++) {
    const genero = i % 3 === 0 ? "Feminino" : "Masculino";
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
      dataNascimento: gerarData(35, i),
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
      experienciaAnos: 3 + (i % 15),
      observacoes: i % 5 === 0 ? "Motorista experiente e pontual." : null,
      status: "ativo",
      transporteId: transportes[i].id,
    };

    try {
      const created = await prisma.motorista.create({
        data: motorista,
      });
      
      const empresaNome = transportes[i].proprietarios.length > 0 
        ? transportes[i].proprietarios[0].proprietario.nome 
        : "Sem empresa";
      
      console.log(`✅ ${i + 1}/${totalMotoristas} - ${created.nome} → ${transportes[i].matricula} | ${empresaNome}`);
    } catch (error: any) {
      console.error(`❌ Erro ao criar motorista ${nome}:`, error.message);
    }
  }

  console.log('\n✨ Motoristas recriados com sucesso!');
  console.log(`📊 Total: ${totalMotoristas} motoristas com dados completos`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
