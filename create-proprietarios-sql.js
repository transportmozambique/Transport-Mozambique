const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createProprietarios() {
  try {
    console.log('=== CRIANDO PROPRIETÁRIOS INDIVIDUAIS ===\n');

    const individuos = [
      ['João Macamo', '110000001A', 'Moçambicana', '1978-03-15', 'Bairro da Polana, Av. Mao Tse Tung, 234, Maputo', 84123456, 82345678, 'Indivíduo', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=faces'],
      ['Maria Cossa', '110000002B', 'Moçambicana', '1985-07-22', 'Bairro Central, Rua da Resistência, 567, Maputo', 84234567, 82456789, 'Indivíduo', 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&h=400&fit=crop&crop=faces'],
      ['Carlos Nhantumbo', '110000003C', 'Moçambicana', '1982-11-08', 'Bairro da Sommerschield, Av. Vladimir Lenine, 890, Maputo', 84345678, null, 'Indivíduo', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=faces'],
      ['Ana Sitoe', '110000004D', 'Moçambicana', '1990-05-30', 'Bairro da Malhangalene, Rua Pereira do Lago, 123, Maputo', 84456789, 82567890, 'Indivíduo', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=faces'],
      ['Pedro Chissano', '110000005E', 'Moçambicana', '1975-09-12', 'Bairro da Matola, Av. da Independência, 456, Matola', 84567890, null, 'Indivíduo', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=faces'],
      ['Isabel Mondlane', '110000006F', 'Moçambicana', '1988-02-18', 'Bairro da Maxaquene, Rua dos Continuadores, 789, Maputo', 84678901, 82789012, 'Indivíduo', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=faces'],
      ['Fernando Guambe', '110000007G', 'Moçambicana', '1980-06-25', 'Bairro da Machava, Rua Principal, 321, Matola', 84789012, null, 'Indivíduo', 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=400&h=400&fit=crop&crop=faces'],
      ['Beatriz Mahumane', '110000008H', 'Moçambicana', '1992-04-10', 'Bairro da Matola Rio, Av. da Namaacha, 654, Matola', 84890123, 82901234, 'Indivíduo', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=faces']
    ];

    for (const [nome, bi, nacionalidade, birthDate, endereco, contacto1, contacto2, tipoProprietario, foto] of individuos) {
      try {
        await prisma.$executeRaw`
          INSERT INTO "Proprietario" (id, nome, bi, nacionalidade, "birthDate", endereco, contacto1, contacto2, "tipoProprietario", foto, "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), ${nome}, ${bi}, ${nacionalidade}, ${new Date(birthDate)}, ${endereco}, ${contacto1}, ${contacto2}, ${tipoProprietario}, ${foto}, NOW(), NOW())
        `;
        console.log(`✓ Criado: ${nome}`);
      } catch (error) {
        if (error.code === '23505') {
          console.log(`⚠ ${nome} - BI já existe, pulando...`);
        } else {
          console.error(`✗ Erro ao criar ${nome}:`, error.message);
        }
      }
    }

    // Count final
    const result = await prisma.$queryRaw`
      SELECT 
        "tipoProprietario",
        COUNT(*) as total
      FROM "Proprietario"
      GROUP BY "tipoProprietario"
      ORDER BY "tipoProprietario"
    `;

    console.log('\n=== TOTAIS FINAIS ===');
    result.forEach(r => {
      console.log(`${r.tipoProprietario}: ${r.total}`);
    });

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createProprietarios();
