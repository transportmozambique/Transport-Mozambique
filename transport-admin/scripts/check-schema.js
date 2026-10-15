const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSchema() {
  try {
    // Check Proprietario table columns
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Proprietario' 
      ORDER BY ordinal_position;
    `;
    
    console.log('\n📋 Proprietario table columns:');
    result.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });
    
    // Check if birthDate exists
    const hasColumn = result.some(col => col.column_name === 'birthDate');
    console.log(`\n${hasColumn ? '✅' : '❌'} birthDate column ${hasColumn ? 'exists' : 'MISSING'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSchema();
