import { prisma } from '../lib/prisma';

async function main() {
  const id = 'cmotb5q8m00ddkh6th39fn7dl';
  
  console.log('🔍 Testando busca exatamente como a API faz...\n');
  
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
      console.log('❌ Motorista não encontrado');
      return;
    }

    console.log('✅ SUCESSO! Motorista encontrado:');
    console.log('Nome:', motorista.nome);
    console.log('Foto:', motorista.foto);
    console.log('Data Nascimento:', motorista.dataNascimento);
    console.log('Transporte:', motorista.transporte?.matricula);
    console.log('\n📄 JSON completo:');
    console.log(JSON.stringify(motorista, null, 2));
  } catch (error: any) {
    console.error('❌ ERRO:', error.message);
    console.error(error);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
