const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const provincias = [
  { nome: 'Maputo', codigo: 'MPT', geoLocation: '-25.9655,32.5892' },
  { nome: 'Gaza', codigo: 'GAZ', geoLocation: '-24.0833,33.6333' },
  { nome: 'Inhambane', codigo: 'INH', geoLocation: '-23.8650,35.3833' },
  { nome: 'Sofala', codigo: 'SOF', geoLocation: '-19.8436,34.8389' },
  { nome: 'Manica', codigo: 'MAN', geoLocation: '-18.9333,32.8667' },
  { nome: 'Tete', codigo: 'TET', geoLocation: '-16.1564,33.5867' },
  { nome: 'Zambézia', codigo: 'ZAM', geoLocation: '-17.8739,36.8867' },
  { nome: 'Nampula', codigo: 'NAM', geoLocation: '-15.1165,39.2666' },
  { nome: 'Niassa', codigo: 'NIA', geoLocation: '-13.2667,35.2667' },
  { nome: 'Cabo Delgado', codigo: 'CBD', geoLocation: '-12.9667,40.5167' },
  { nome: 'Maputo Cidade', codigo: 'MPC', geoLocation: '-25.9692,32.5732' },
];

async function seedProvincias() {
  try {
    console.log('🌱 Populando províncias de Moçambique...\n');

    for (const provincia of provincias) {
      // Check if already exists
      const existing = await prisma.provincia.findUnique({
        where: { codigo: provincia.codigo },
      });

      if (existing) {
        console.log(`⏭️  ${provincia.nome} (${provincia.codigo}) - já existe`);
      } else {
        await prisma.provincia.create({
          data: provincia,
        });
        console.log(`✅ ${provincia.nome} (${provincia.codigo}) - criada`);
      }
    }

    console.log('\n🎉 Processo concluído!');
    console.log(`📊 Total de províncias: ${provincias.length}\n`);

  } catch (error) {
    console.error('❌ Erro ao popular províncias:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedProvincias();
