const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.administrador.findMany({
    select: {
      id: true,
      nome: true,
      email: true
    }
  });
  console.log('Administradores:');
  console.log(JSON.stringify(admins, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
