import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 PESQUISA PROFUNDA NA BASE DE DADOS\n');
  console.log('='.repeat(80));

  // 1. Contar tudo
  const totalTransportes = await prisma.transporte.count();
  const totalProprietarios = await prisma.proprietario.count();
  const totalMotoristas = await prisma.motorista.count();
  const totalVias = await prisma.via.count();

  console.log('\n📊 TOTAIS:');
  console.log(`   Transportes: ${totalTransportes}`);
  console.log(`   Proprietários: ${totalProprietarios}`);
  console.log(`   Motoristas: ${totalMotoristas}`);
  console.log(`   Vias: ${totalVias}`);

  // 2. Buscar TODOS os transportes sem filtro
  console.log('\n🚌 BUSCANDO TODOS OS TRANSPORTES...\n');
  
  const allTransportes = await prisma.$queryRaw<any[]>`
    SELECT matricula, marca, modelo, codigo 
    FROM "Transporte" 
    ORDER BY codigo ASC
  `;

  console.log(`Encontrados: ${allTransportes.length} transportes\n`);

  // Agrupar por prefixo
  const grupos: { [key: string]: any[] } = {};
  allTransportes.forEach(t => {
    const prefixo = t.matricula.substring(0, 3);
    if (!grupos[prefixo]) {
      grupos[prefixo] = [];
    }
    grupos[prefixo].push(t);
  });

  console.log('📋 TRANSPORTES POR PREFIXO:\n');
  Object.keys(grupos).sort().forEach(prefixo => {
    console.log(`${prefixo}: ${grupos[prefixo].length} transportes`);
    // Mostrar primeiros 3 de cada grupo
    grupos[prefixo].slice(0, 3).forEach(t => {
      console.log(`   - ${t.matricula} (${t.marca} ${t.modelo})`);
    });
    if (grupos[prefixo].length > 3) {
      console.log(`   ... e mais ${grupos[prefixo].length - 3}`);
    }
    console.log();
  });

  // 3. Buscar proprietários
  console.log('🏢 PROPRIETÁRIOS:\n');
  
  const proprietarios = await prisma.proprietario.findMany({
    include: {
      transportes: {
        include: {
          transporte: true
        }
      }
    }
  });

  proprietarios.forEach((p, i) => {
    console.log(`${i + 1}. ${p.nome} (BI: ${p.bi})`);
    console.log(`   Transportes: ${p.transportes.length}`);
    if (p.transportes.length > 0) {
      p.transportes.slice(0, 2).forEach(tp => {
        console.log(`   - ${tp.transporte.matricula}`);
      });
      if (p.transportes.length > 2) {
        console.log(`   ... e mais ${p.transportes.length - 2}`);
      }
    }
    console.log();
  });

  // 4. Verificar se há matrículas diferentes de AAA
  console.log('🔍 MATRÍCULAS ÚNICAS (primeiras 50):\n');
  
  const uniqueMatriculas = await prisma.$queryRaw<any[]>`
    SELECT DISTINCT matricula 
    FROM "Transporte" 
    ORDER BY matricula ASC 
    LIMIT 50
  `;

  uniqueMatriculas.forEach((m, i) => {
    console.log(`${i + 1}. ${m.matricula}`);
  });

  console.log('\n' + '='.repeat(80));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
