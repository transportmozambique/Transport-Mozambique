const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Restoring system to 111 transportes and 111 vias...\n');

  // Step 1: Get current state
  const currentTransportes = await prisma.transporte.findMany({
    include: { via: true }
  });
  
  const currentVias = await prisma.via.findMany({
    include: {
      _count: {
        select: { transportes: true }
      }
    }
  });

  console.log(`📊 Current state:`);
  console.log(`   Transportes: ${currentTransportes.length}`);
  console.log(`   Vias: ${currentVias.length}\n`);

  // Step 2: Get municipios
  const municipios = await prisma.municipio.findMany();
  const maputoMunicipio = municipios.find(m => m.nome === 'Maputo');
  const matolaMunicipio = municipios.find(m => m.nome === 'Matola');

  if (!maputoMunicipio || !matolaMunicipio) {
    console.error('❌ Municípios not found!');
    return;
  }

  console.log(`✅ Found municípios:`);
  console.log(`   Maputo: ${maputoMunicipio.id}`);
  console.log(`   Matola: ${matolaMunicipio.id}\n`);

  // Step 3: Create missing transportes (111 - current)
  const transportesToCreate = 111 - currentTransportes.length;
  console.log(`🚌 Creating ${transportesToCreate} missing transportes...\n`);

  const newTransportes = [];
  for (let i = 0; i < transportesToCreate; i++) {
    const codigo = 100 + currentTransportes.length + i + 1;
    const matricula = `ACK-${String(codigo).padStart(3, '0')}M`;
    
    const transporte = await prisma.transporte.create({
      data: {
        codigo: codigo,
        matricula: matricula,
        modelo: 'Sprinter',
        marca: 'Mercedes-Benz',
        lotacao: 22,
        cor: '#FFFFFF',
        codigoVia: 'TBD', // Will be updated when assigned to via
        // No via assignment yet
      }
    });
    
    newTransportes.push(transporte);
    
    if ((i + 1) % 10 === 0) {
      console.log(`   Created ${i + 1}/${transportesToCreate} transportes...`);
    }
  }

  console.log(`✅ Created ${newTransportes.length} new transportes\n`);

  // Step 4: Create missing vias (111 - current)
  const viasToCreate = 111 - currentVias.length;
  console.log(`🛣️  Creating ${viasToCreate} missing vias...\n`);

  const newVias = [];
  const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  
  for (let i = 0; i < viasToCreate; i++) {
    const viaNumber = currentVias.length + i + 1;
    const codigo = `VIA-${String(viaNumber).padStart(3, '0')}`;
    const color = colors[i % colors.length];
    
    // Alternate between Maputo and Matola
    const municipio = i % 2 === 0 ? maputoMunicipio : matolaMunicipio;
    
    const via = await prisma.via.create({
      data: {
        nome: `Rota ${viaNumber}`,
        codigo: codigo,
        cor: color,
        terminalPartida: 'Terminal A',
        terminalChegada: 'Terminal B',
        geoLocationPath: '32.5694,-25.9734;32.5714,-25.9688',
        codigoMunicipio: municipio.codigo,
        municipioId: municipio.id,
      }
    });
    
    newVias.push(via);
    
    if ((i + 1) % 10 === 0) {
      console.log(`   Created ${i + 1}/${viasToCreate} vias...`);
    }
  }

  console.log(`✅ Created ${newVias.length} new vias\n`);

  // Step 5: Assign each transporte to a via (one-to-one)
  console.log(`🔗 Assigning transportes to vias (one-to-one)...\n`);

  const allTransportes = await prisma.transporte.findMany({
    orderBy: { codigo: 'asc' }
  });
  
  const allVias = await prisma.via.findMany({
    orderBy: { codigo: 'asc' }
  });

  let assigned = 0;
  for (let i = 0; i < Math.min(allTransportes.length, allVias.length); i++) {
    const transporte = allTransportes[i];
    const via = allVias[i];
    
    await prisma.transporte.update({
      where: { id: transporte.id },
      data: { 
        viaId: via.id,
        codigoVia: via.codigo
      }
    });
    
    assigned++;
    
    if ((i + 1) % 20 === 0) {
      console.log(`   Assigned ${i + 1}/${allTransportes.length} transportes...`);
    }
  }

  console.log(`✅ Assigned ${assigned} transportes to vias\n`);

  // Step 6: Final verification
  const finalTransportes = await prisma.transporte.findMany({
    include: { via: true }
  });
  
  const finalVias = await prisma.via.findMany({
    include: {
      _count: {
        select: { transportes: true }
      }
    }
  });

  const transportesWithVia = finalTransportes.filter(t => t.via).length;
  const transportesWithoutVia = finalTransportes.filter(t => !t.via).length;
  const viasWithTransportes = finalVias.filter(v => v._count.transportes > 0).length;
  const viasWithoutTransportes = finalVias.filter(v => v._count.transportes === 0).length;

  console.log(`\n📊 Final state:`);
  console.log(`   Total transportes: ${finalTransportes.length}`);
  console.log(`   - With via: ${transportesWithVia}`);
  console.log(`   - Without via: ${transportesWithoutVia}`);
  console.log(`   Total vias: ${finalVias.length}`);
  console.log(`   - With transportes: ${viasWithTransportes}`);
  console.log(`   - Without transportes: ${viasWithoutTransportes}`);

  if (finalTransportes.length === 111 && finalVias.length === 111) {
    console.log(`\n✅ System restored successfully!`);
    console.log(`   ✓ 111 transportes`);
    console.log(`   ✓ 111 vias`);
    console.log(`   ✓ One-to-one assignment`);
  } else {
    console.log(`\n⚠️  System state:`);
    console.log(`   Expected: 111 transportes, 111 vias`);
    console.log(`   Actual: ${finalTransportes.length} transportes, ${finalVias.length} vias`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
