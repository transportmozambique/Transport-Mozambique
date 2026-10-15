const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRoutes() {
  const routes = await prisma.via.findMany({
    select: { codigo: true, nome: true },
    orderBy: { codigo: 'asc' }
  });
  
  console.log('All Routes in Database:\n');
  routes.forEach(r => {
    console.log(`${r.codigo.padEnd(20)} ${r.nome}`);
  });
  
  console.log(`\nTotal: ${routes.length} routes`);
  
  await prisma.$disconnect();
}

checkRoutes();
