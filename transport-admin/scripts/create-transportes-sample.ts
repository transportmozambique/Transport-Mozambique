import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Criando transportes de exemplo...\n');

  // Verificar se já existem vias
  const vias = await prisma.via.findMany();
  
  if (vias.length === 0) {
    console.log('⚠️  Não há vias na base de dados!');
    console.log('   Criando via de exemplo...\n');
    
    // Criar município primeiro
    const municipio = await prisma.municipio.upsert({
      where: { codigo: 'MUN001' },
      update: {},
      create: {
        nome: 'Maputo',
        codigo: 'MUN001',
        endereco: 'Maputo, Moçambique',
      }
    });

    // Criar via de exemplo
    const via = await prisma.via.create({
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
    
    vias.push(via);
    console.log(`✅ Via criada: ${via.nome}\n`);
  }

  const via = vias[0];

  // Criar 111 transportes
  const marcas = ['Toyota', 'Mercedes', 'Volkswagen', 'Nissan', 'Isuzu'];
  const modelos = ['Hiace', 'Sprinter', 'Crafter', 'Urvan', 'NQR'];
  const cores = ['Branco', 'Azul', 'Vermelho', 'Verde', 'Amarelo'];

  console.log('🚌 Criando 111 transportes...\n');

  for (let i = 0; i < 111; i++) {
    const codigo = i + 1;
    const marca = marcas[i % marcas.length];
    const modelo = modelos[i % modelos.length];
    const cor = cores[i % cores.length];
    const matricula = `AAA-${String(codigo).padStart(4, '0')}`;

    try {
      await prisma.transporte.upsert({
        where: { codigo },
        update: {},
        create: {
          matricula,
          modelo,
          marca,
          cor,
          lotacao: 15,
          codigo,
          codigoVia: via.codigo,
          viaId: via.id,
          currGeoLocation: '32.5892,-25.9655',
        }
      });

      console.log(`✅ ${i + 1}/111 - ${matricula} (${marca} ${modelo})`);
    } catch (error: any) {
      console.error(`❌ Erro ao criar transporte ${matricula}:`, error.message);
    }
  }

  console.log('\n✨ Transportes criados com sucesso!');
  console.log('📊 Total: 111 transportes');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
