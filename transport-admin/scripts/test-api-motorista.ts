import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Testando busca de motorista...\n');

  const id = 'cmotb68e900hpkh6tayt3lst6';
  
  try {
    const motorista = await prisma.motorista.findUnique({
      where: { id },
      include: {
        transporte: {
          select: {
            id: true,
            matricula: true,
            modelo: true,
            marca: true,
            via: {
              select: {
                nome: true,
                codigo: true,
              },
            },
            proprietarios: {
              include: {
                proprietario: {
                  select: {
                    id: true,
                    nome: true,
                    bi: true,
                    nacionalidade: true,
                    endereco: true,
                    contacto1: true,
                    contacto2: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!motorista) {
      console.log('❌ Motorista não encontrado com ID:', id);
      
      // Buscar qualquer motorista
      const primeiro = await prisma.motorista.findFirst();
      if (primeiro) {
        console.log('\n✅ Primeiro motorista encontrado:');
        console.log('ID:', primeiro.id);
        console.log('Nome:', primeiro.nome);
      }
      return;
    }

    console.log('✅ Motorista encontrado!');
    console.log(JSON.stringify(motorista, null, 2));
  } catch (error: any) {
    console.error('❌ ERRO:', error.message);
    console.error(error);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
