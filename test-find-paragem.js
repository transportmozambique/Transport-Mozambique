/**
 * Test finding paragens
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    console.log('Testing paragem search...\n');
    
    // Test 1: Find Aeroporto
    console.log('1. Searching for "Aeroporto"...');
    const aeroporto = await prisma.paragem.findFirst({
      where: {
        nome: {
          contains: 'Aeroporto',
          mode: 'insensitive'
        }
      }
    });
    
    if (aeroporto) {
      console.log(`✅ Found: ${aeroporto.nome} (ID: ${aeroporto.id})`);
    } else {
      console.log('❌ Not found');
    }
    
    // Test 2: Find Praça dos Trabalhadores
    console.log('\n2. Searching for "Praça dos Trabalhadores"...');
    const praca = await prisma.paragem.findFirst({
      where: {
        nome: {
          contains: 'Praça dos Trabalhadores',
          mode: 'insensitive'
        }
      }
    });
    
    if (praca) {
      console.log(`✅ Found: ${praca.nome} (ID: ${praca.id})`);
    } else {
      console.log('❌ Not found');
    }
    
    // Test 3: Find vias that pass through Aeroporto
    if (aeroporto) {
      console.log(`\n3. Finding vias that pass through ${aeroporto.nome}...`);
      const vias = await prisma.via.findMany({
        where: {
          paragens: {
            some: {
              paragemId: aeroporto.id
            }
          }
        },
        select: {
          id: true,
          nome: true
        },
        take: 5
      });
      
      console.log(`✅ Found ${vias.length} vias:`);
      vias.forEach(v => console.log(`   - ${v.nome}`));
    }
    
    console.log('\n✅ Test complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
