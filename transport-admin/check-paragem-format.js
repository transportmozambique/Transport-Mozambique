const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkParagem() {
  const paragem = await prisma.paragem.findFirst();
  console.log('Sample paragem:', JSON.stringify(paragem, null, 2));
  await prisma.$disconnect();
}

checkParagem();
