const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Adding Missing Associations\n');
  console.log('='.repeat(80) + '\n');

  // Add PAR-0498 to V099
  const par0498 = await prisma.paragem.findUnique({ where: { codigo: 'PAR-0498' } });
  const v099 = await prisma.via.findUnique({ where: { codigo: 'V099' } });

  if (par0498 && v099) {
    try {
      await prisma.viaParagem.create({
        data: {
          codigoParagem: par0498.codigo,
          codigoVia: v099.codigo,
          viaId: v099.id,
          paragemId: par0498.id,
          terminalBoolean: false
        }
      });
      console.log(`✅ Added: V099 - PAR-0498 (Fundisandra)`);
    } catch (error) {
      console.log(`⚠️  Already exists: V099 - PAR-0498`);
    }
  }

  // Add PAR-0499 to V099
  const par0499 = await prisma.paragem.findUnique({ where: { codigo: 'PAR-0499' } });

  if (par0499 && v099) {
    try {
      await prisma.viaParagem.create({
        data: {
          codigoParagem: par0499.codigo,
          codigoVia: v099.codigo,
          viaId: v099.id,
          paragemId: par0499.id,
          terminalBoolean: false
        }
      });
      console.log(`✅ Added: V099 - PAR-0499 (Hospital)`);
    } catch (error) {
      console.log(`⚠️  Already exists: V099 - PAR-0499`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Complete!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
