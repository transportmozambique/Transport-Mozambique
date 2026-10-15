const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function testAdminLogin() {
  try {
    console.log('🔐 Testing Admin Login Credentials\n');
    console.log('='.repeat(60));

    // Get all admins
    const admins = await prisma.administrador.findMany({
      select: {
        id: true,
        nome: true,
        email: true,
        senha: true,
      }
    });

    if (admins.length === 0) {
      console.log('\n❌ No administrators found in database!');
      console.log('\nTo create an admin, run:');
      console.log('  node transport-admin/create-admin.js');
      return;
    }

    console.log(`\n✅ Found ${admins.length} administrator(s):\n`);

    for (const admin of admins) {
      console.log('─'.repeat(60));
      console.log(`📧 Email:    ${admin.email}`);
      console.log(`👤 Name:     ${admin.nome}`);
      console.log(`🆔 ID:       ${admin.id}`);
      
      // Check if password is hashed
      const isHashed = admin.senha.startsWith('$2a$') || admin.senha.startsWith('$2b$');
      
      if (isHashed) {
        console.log(`🔒 Password: [HASHED with bcrypt]`);
        
        // Test common passwords
        const testPasswords = ['admin123', 'Admin@2026', 'password', 'admin'];
        console.log('\n🧪 Testing common passwords:');
        
        for (const testPass of testPasswords) {
          const matches = await bcrypt.compare(testPass, admin.senha);
          if (matches) {
            console.log(`   ✅ '${testPass}' - WORKS!`);
          } else {
            console.log(`   ❌ '${testPass}' - doesn't work`);
          }
        }
      } else {
        console.log(`🔓 Password: ${admin.senha} [PLAIN TEXT]`);
        console.log('\n⚠️  WARNING: Password is stored in plain text!');
        console.log('   This is OK for development, but should be hashed in production.');
      }
      
      console.log('\n📝 Login Instructions:');
      console.log('   1. Go to: http://localhost:3000/admin/login');
      console.log(`   2. Enter email: ${admin.email}`);
      if (!isHashed) {
        console.log(`   3. Enter password: ${admin.senha}`);
      } else {
        console.log(`   3. Enter the password that matches (see above)`);
      }
      console.log('');
    }

    console.log('='.repeat(60));
    console.log('\n💡 TIPS:');
    console.log('   - The API endpoint /api/auth/admin accepts both plain and hashed passwords');
    console.log('   - You can also use: username="admin" password="admin123" (hardcoded fallback)');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.message.includes('P1001') || error.message.includes("Can't reach")) {
      console.log('\n💡 Database connection failed. Make sure:');
      console.log('   - DATABASE_URL is set in .env file');
      console.log('   - Database server is running');
      console.log('   - Network connection is active');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testAdminLogin();
