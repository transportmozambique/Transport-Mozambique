import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🛣️  Criando vias para cada transporte...\n');

  // Verificar município
  let municipio = await prisma.municipio.findFirst();
  if (!municipio) {
    municipio = await prisma.municipio.create({
      data: {
        nome: 'Maputo',
        codigo: 'MUN001',
        endereco: 'Maputo, Moçambique',
      }
    });
    console.log('✅ Município criado\n');
  }

  // Buscar todos os transportes
  const transportes = await prisma.transporte.findMany({
    orderBy: { codigo: 'asc' }
  });

  console.log(`📊 Total de transportes: ${transportes.length}\n`);

  // Nomes de bairros e zonas de Maputo e Matola
  const origens = [
    'Maputo Centro', 'Polana', 'Sommerschield', 'Malhangalene', 'Maxaquene',
    'Xipamanine', 'Chamanculo', 'Mavalane', 'Benfica', 'Hulene',
    'Laulane', 'Zimpeto', 'Albazine', 'Costa do Sol', 'Catembe',
    'Julius Nyerere', 'Marginal', 'Baixa', 'Alto Maé', 'Jardim'
  ];

  const destinos = [
    'Matola Gare', 'Machava', 'Matola Rio', 'Matola Santos', 'Matola C',
    'Matola A', 'Matola B', 'Matola D', 'Matola E', 'Matola F',
    'Boane', 'Marracuene', 'Manhiça', 'Xinavane', 'Magude',
    'Moamba', 'Namaacha', 'Bela Vista', 'Infulene', 'Fomento'
  ];

  const cores = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
    '#06B6D4', '#F43F5E', '#22C55E', '#EAB308', '#A855F7'
  ];

  console.log('🚀 Criando vias...\n');

  for (let i = 0; i < transportes.length; i++) {
    const transporte = transportes[i];
    const origem = origens[i % origens.length];
    const destino = destinos[i % destinos.length];
    const cor = cores[i % cores.length];
    const codigo = `V${String(i + 1).padStart(3, '0')}`;
    const nome = `${origem} - ${destino}`;

    try {
      // Criar via
      const via = await prisma.via.upsert({
        where: { codigo },
        update: {},
        create: {
          nome,
          codigo,
          cor,
          terminalPartida: origem,
          terminalChegada: destino,
          geoLocationPath: `32.${5892 + (i * 10)},${-25.9655 + (i * 0.001)};32.${6089 + (i * 10)},${-25.9655 + (i * 0.001)}`,
          codigoMunicipio: municipio.codigo,
          municipioId: municipio.id,
        }
      });

      // Atualizar transporte para usar esta via
      await prisma.transporte.update({
        where: { id: transporte.id },
        data: {
          codigoVia: via.codigo,
          viaId: via.id,
        }
      });

      if ((i + 1) % 10 === 0) {
        console.log(`✅ ${i + 1}/${transportes.length} vias criadas...`);
      }
    } catch (error: any) {
      console.error(`❌ Erro ao criar via ${codigo}:`, error.message);
    }
  }

  console.log(`\n✅ ${transportes.length} vias criadas!`);

  // Estatísticas
  const totalVias = await prisma.via.count();
  const transportesComVia = await prisma.transporte.count({
    where: {
      via: {
        isNot: null
      }
    }
  });

  console.log('\n📊 ESTATÍSTICAS:');
  console.log(`   Total de vias: ${totalVias}`);
  console.log(`   Transportes com via: ${transportesComVia}`);
  console.log(`   Cada transporte tem sua própria via!`);

  // Mostrar exemplos
  console.log('\n📋 EXEMPLOS DE VIAS:\n');
  const exemplos = await prisma.via.findMany({
    take: 10,
    include: {
      transportes: {
        select: {
          matricula: true
        }
      }
    }
  });

  exemplos.forEach((via, i) => {
    console.log(`${i + 1}. ${via.nome} (${via.codigo})`);
    console.log(`   Cor: ${via.cor}`);
    console.log(`   Transportes: ${via.transportes.map(t => t.matricula).join(', ')}`);
    console.log();
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
