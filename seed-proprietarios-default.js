const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedProprietariosDefault() {
  try {
    console.log('🚀 Criando proprietários predefinidos...\n');

    const proprietariosDefault = [
      {
        nome: 'TransMoz Transportes Lda',
        telefone: '+258 84 100 1000',
        email: 'geral@transmoz.co.mz',
        endereco: 'Av. Julius Nyerere, Maputo'
      },
      {
        nome: 'Rodoviária de Moçambique',
        telefone: '+258 84 200 2000',
        email: 'contacto@rodoviaria.co.mz',
        endereco: 'Av. 24 de Julho, Maputo'
      },
      {
        nome: 'Transportes Matola SA',
        telefone: '+258 84 300 3000',
        email: 'info@transmatola.co.mz',
        endereco: 'Av. da Namaacha, Matola'
      },
      {
        nome: 'Oliveiras Transportes',
        telefone: '+258 84 400 4000',
        email: 'oliveiras@transportes.co.mz',
        endereco: 'Av. Eduardo Mondlane, Maputo'
      },
      {
        nome: 'Grupo TPM - Transportes Públicos',
        telefone: '+258 84 500 5000',
        email: 'tpm@transportes.co.mz',
        endereco: 'Av. Mao Tse Tung, Maputo'
      }
    ];

    console.log(`📝 Criando ${proprietariosDefault.length} proprietários...\n`);

    for (const prop of proprietariosDefault) {
      // Verificar se já existe
      const existe = await prisma.proprietario.findFirst({
        where: { email: prop.email }
      });

      if (existe) {
        console.log(`   ⏭️  ${prop.nome} - Já existe`);
      } else {
        await prisma.proprietario.create({
          data: prop
        });
        console.log(`   ✅ ${prop.nome} - Criado`);
      }
    }

    console.log('\n🎉 Proprietários predefinidos criados com sucesso!');
    console.log('\n📊 Próximo passo: Execute o script para atribuir aos autocarros:');
    console.log('   node assign-proprietarios-to-all-buses.js');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedProprietariosDefault();
