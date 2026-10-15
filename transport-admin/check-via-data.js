const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Verificando dados das vias...\n');

  // Get total count
  const total = await prisma.via.count();
  console.log(`Total de vias: ${total}`);

  // Get vias with geoLocationPath
  const withPath = await prisma.via.count({
    where: {
      geoLocationPath: {
        not: '',
      },
    },
  });
  console.log(`Vias com geoLocationPath: ${withPath}\n`);

  // Get first 3 vias
  const vias = await prisma.via.findMany({
    take: 3,
    select: {
      id: true,
      nome: true,
      codigo: true,
      geoLocationPath: true,
      cor: true,
    },
  });

  console.log('Primeiras 3 vias:\n');
  vias.forEach((via, index) => {
    console.log(`${index + 1}. ${via.nome} (${via.codigo})`);
    console.log(`   ID: ${via.id}`);
    console.log(`   Cor: ${via.cor}`);
    console.log(`   Tem geoLocationPath: ${!!via.geoLocationPath}`);
    
    if (via.geoLocationPath) {
      console.log(`   Tamanho do path: ${via.geoLocationPath.length} caracteres`);
      console.log(`   Primeiros 100 caracteres: ${via.geoLocationPath.substring(0, 100)}`);
      
      // Parse coordinates
      try {
        const coords = via.geoLocationPath.split(';').map(point => {
          const [lng, lat] = point.trim().split(',').map(Number);
          return { lng, lat };
        });
        console.log(`   Número de coordenadas: ${coords.length}`);
        console.log(`   Primeira coordenada: lng=${coords[0].lng}, lat=${coords[0].lat}`);
        console.log(`   Última coordenada: lng=${coords[coords.length-1].lng}, lat=${coords[coords.length-1].lat}`);
      } catch (e) {
        console.log(`   Erro ao parsear: ${e.message}`);
      }
    } else {
      console.log(`   geoLocationPath está vazio ou null`);
    }
    console.log('');
  });
}

main()
  .catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
