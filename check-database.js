const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env' });

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('🔍 Checking database...\n');
    
    // Check Municipios
    const municipios = await prisma.municipio.findMany({
      select: {
        id: true,
        nome: true,
        codigo: true,
      },
    });
    console.log('📊 Municipios:', municipios.length);
    municipios.forEach(m => {
      console.log(`  - ${m.nome} (ID: ${m.id})`);
    });
    
    console.log('\n');
    
    // Check Vias
    const vias = await prisma.via.findMany({
      select: {
        id: true,
        nome: true,
        codigo: true,
        municipioId: true,
      },
    });
    console.log('📊 Vias:', vias.length);
    vias.forEach(v => {
      console.log(`  - ${v.nome} (ID: ${v.id}, MunicipioID: ${v.municipioId})`);
    });
    
    console.log('\n');
    
    // Check Paragens
    const paragens = await prisma.paragem.findMany({
      select: {
        id: true,
        nome: true,
        codigo: true,
      },
    });
    console.log('📊 Paragens:', paragens.length);
    paragens.forEach(p => {
      console.log(`  - ${p.nome} (ID: ${p.id})`);
    });
    
    console.log('\n');
    
    // Check ViaParagem relationships
    const viaParagens = await prisma.viaParagem.findMany({
      select: {
        viaId: true,
        paragemId: true,
      },
    });
    console.log('📊 ViaParagem relationships:', viaParagens.length);
    
    // Group by viaId
    const byVia = {};
    viaParagens.forEach(vp => {
      if (!byVia[vp.viaId]) {
        byVia[vp.viaId] = [];
      }
      byVia[vp.viaId].push(vp.paragemId);
    });
    
    console.log('\n🔗 Vias and their Paragens:');
    Object.entries(byVia).forEach(([viaId, paragemIds]) => {
      const via = vias.find(v => v.id === viaId);
      console.log(`  - ${via?.nome || viaId}: ${paragemIds.length} paragens`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
