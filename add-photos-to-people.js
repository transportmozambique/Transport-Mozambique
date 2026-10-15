const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Fotos de pessoas negras do Unsplash (alta qualidade, gratuitas)
const fotosHomens = [
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1522556189639-b150ed9c4330?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1504593811423-6dd665756598?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&h=400&fit=crop&crop=faces',
];

const fotosMulheres = [
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=400&h=400&fit=crop&crop=faces',
];

async function addPhotos() {
  try {
    console.log('=== ATUALIZANDO FOTOS DOS MOTORISTAS ===\n');

    // Get all motoristas
    const motoristas = await prisma.motorista.findMany({
      orderBy: { nome: 'asc' }
    });

    let homemIndex = 0;
    let mulherIndex = 0;

    for (const motorista of motoristas) {
      let foto;
      if (motorista.genero === 'Feminino') {
        foto = fotosMulheres[mulherIndex % fotosMulheres.length];
        mulherIndex++;
      } else {
        foto = fotosHomens[homemIndex % fotosHomens.length];
        homemIndex++;
      }

      await prisma.motorista.update({
        where: { id: motorista.id },
        data: { foto }
      });

      console.log(`✓ ${motorista.nome} (${motorista.genero}) - Foto adicionada`);
    }

    console.log(`\n✅ ${motoristas.length} motoristas atualizados com fotos\n`);

    console.log('=== CRIANDO PROPRIETÁRIOS INDIVIDUAIS ===\n');

    // Proprietários individuais moçambicanos
    const individuos = [
      {
        nome: 'João Macamo',
        bi: '110000001A',
        nacionalidade: 'Moçambicana',
        birthDate: new Date('1978-03-15'),
        endereco: 'Bairro da Polana, Av. Mao Tse Tung, 234, Maputo',
        contacto1: 84123456,
        contacto2: 82345678,
        tipoProprietario: 'Indivíduo',
        foto: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=faces'
      },
      {
        nome: 'Maria Cossa',
        bi: '110000002B',
        nacionalidade: 'Moçambicana',
        birthDate: new Date('1985-07-22'),
        endereco: 'Bairro Central, Rua da Resistência, 567, Maputo',
        contacto1: 84234567,
        contacto2: 82456789,
        tipoProprietario: 'Indivíduo',
        foto: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&h=400&fit=crop&crop=faces'
      },
      {
        nome: 'Carlos Nhantumbo',
        bi: '110000003C',
        nacionalidade: 'Moçambicana',
        birthDate: new Date('1982-11-08'),
        endereco: 'Bairro da Sommerschield, Av. Vladimir Lenine, 890, Maputo',
        contacto1: 84345678,
        contacto2: null,
        tipoProprietario: 'Indivíduo',
        foto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=faces'
      },
      {
        nome: 'Ana Sitoe',
        bi: '110000004D',
        nacionalidade: 'Moçambicana',
        birthDate: new Date('1990-05-30'),
        endereco: 'Bairro da Malhangalene, Rua Pereira do Lago, 123, Maputo',
        contacto1: 84456789,
        contacto2: 82567890,
        tipoProprietario: 'Indivíduo',
        foto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=faces'
      },
      {
        nome: 'Pedro Chissano',
        bi: '110000005E',
        nacionalidade: 'Moçambicana',
        birthDate: new Date('1975-09-12'),
        endereco: 'Bairro da Matola, Av. da Independência, 456, Matola',
        contacto1: 84567890,
        contacto2: null,
        tipoProprietario: 'Indivíduo',
        foto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=faces'
      },
      {
        nome: 'Isabel Mondlane',
        bi: '110000006F',
        nacionalidade: 'Moçambicana',
        birthDate: new Date('1988-02-18'),
        endereco: 'Bairro da Maxaquene, Rua dos Continuadores, 789, Maputo',
        contacto1: 84678901,
        contacto2: 82789012,
        tipoProprietario: 'Indivíduo',
        foto: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=faces'
      },
      {
        nome: 'Fernando Guambe',
        bi: '110000007G',
        nacionalidade: 'Moçambicana',
        birthDate: new Date('1980-06-25'),
        endereco: 'Bairro da Machava, Rua Principal, 321, Matola',
        contacto1: 84789012,
        contacto2: null,
        tipoProprietario: 'Indivíduo',
        foto: 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=400&h=400&fit=crop&crop=faces'
      },
      {
        nome: 'Beatriz Mahumane',
        bi: '110000008H',
        nacionalidade: 'Moçambicana',
        birthDate: new Date('1992-04-10'),
        endereco: 'Bairro da Matola Rio, Av. da Namaacha, 654, Matola',
        contacto1: 84890123,
        contacto2: 82901234,
        tipoProprietario: 'Indivíduo',
        foto: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=faces'
      }
    ];

    for (const individuo of individuos) {
      try {
        const created = await prisma.proprietario.create({
          data: individuo
        });
        console.log(`✓ Criado: ${created.nome} (${created.tipoProprietario})`);
      } catch (error) {
        if (error.code === 'P2002') {
          console.log(`⚠ ${individuo.nome} - BI já existe, pulando...`);
        } else {
          console.error(`✗ Erro ao criar ${individuo.nome}:`, error.message);
        }
      }
    }

    // Count final
    const totalProp = await prisma.proprietario.count();
    const empresas = await prisma.$queryRaw`
      SELECT COUNT(*) as total FROM "Proprietario" WHERE "tipoProprietario" = 'Empresa'
    `;
    const individuosCount = await prisma.$queryRaw`
      SELECT COUNT(*) as total FROM "Proprietario" WHERE "tipoProprietario" = 'Indivíduo'
    `;

    console.log('\n=== TOTAIS FINAIS ===');
    console.log(`Motoristas com fotos: ${motoristas.length}`);
    console.log(`Total Proprietários: ${totalProp}`);
    console.log(`  - Empresas: ${empresas[0].total}`);
    console.log(`  - Indivíduos: ${individuosCount[0].total}`);

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addPhotos();
