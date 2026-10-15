const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAdmins() {
  try {
    console.log('=== QUERYING ADMINISTRATORS ===\n');
    
    const admins = await prisma.administrador.findMany({
      select: {
        id: true,
        nome: true,
        email: true,
        senha: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (admins.length === 0) {
      console.log('❌ No administrators found in database.');
      console.log('\nYou may need to create one first.');
    } else {
      console.log(`✅ Found ${admins.length} administrator(s):\n`);
      
      admins.forEach((admin, index) => {
        console.log(`${index + 1}. ${admin.nome}`);
        console.log(`   Email:    ${admin.email}`);
        console.log(`   Password: ${admin.senha}`);
        console.log(`   ID:       ${admin.id}`);
        console.log(`   Created:  ${admin.createdAt}`);
        console.log('');
      });

      console.log('NOTE: If passwords are hashed (long strings), you cannot see the plain text.');
      console.log('      You may need to reset passwords or check seed scripts.\n');
    }

  } catch (error) {
    console.error('❌ Error querying database:', error.message);
    
    if (error.message.includes('P1001') || error.message.includes('Can\'t reach database')) {
      console.log('\n💡 Database connection failed. Check:');
      console.log('   - DATABASE_URL in .env file');
      console.log('   - Database server is running');
      console.log('   - Network connection');
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkAdmins();
