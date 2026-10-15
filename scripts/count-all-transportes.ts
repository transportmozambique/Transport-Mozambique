import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.transporte.count();
  console.log(`📊 Total de transportes na base de dados: ${total}`);
  
  // Contar por prefixo
  const all = await prisma.transporte.findMany({
    select: { matricula: true }
  });
  
  const prefixos: { [key: string]: number } = {};
  all.forEach(t => {
    const prefixo = t.matricula.substring(0, 3);
    prefixos[prefixo] = (prefixos[prefixo] || 0) + 1;
  });
  
  console.log('\n📋 Por prefixo de matrícula:');
  Object.keys(prefixos).sort().forEach(p => {
    console.log(`   ${p}: ${prefixos[p]} transportes`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
