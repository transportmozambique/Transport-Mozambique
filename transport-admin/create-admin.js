const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    // Admin credentials
    const email = 'admin@transportmz.com';
    const senha = 'Admin@2026';
    const nome = 'Super Administrador';

    // Check if admin already exists
    const existingAdmin = await prisma.administrador.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      console.log('❌ Admin já existe com este email:', email);
      console.log('\n📧 Email:', email);
      console.log('🔑 Senha: (use a senha que você definiu anteriormente)');
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(senha, 10);

    // Create admin
    const admin = await prisma.administrador.create({
      data: {
        nome,
        email,
        senha: hashedPassword,
      },
    });

    console.log('✅ Admin criado com sucesso!');
    console.log('\n=== CREDENCIAIS DE LOGIN ===');
    console.log('📧 Email:', email);
    console.log('🔑 Senha:', senha);
    console.log('👤 Nome:', nome);
    console.log('🆔 ID:', admin.id);
    console.log('\n⚠️  IMPORTANTE: Guarde estas credenciais em local seguro!');
    console.log('🌐 Acesse: http://localhost:3000/login');
    console.log('\n📝 NOTA: Após conectar o banco de dados e rodar as migrações,');
    console.log('   este admin terá role "admin" e status "ativo" por padrão.');
  } catch (error) {
    console.error('❌ Erro ao criar admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
