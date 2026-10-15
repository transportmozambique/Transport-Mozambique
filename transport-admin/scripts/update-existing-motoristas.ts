import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// APIs de fotos realistas de pessoas geradas por IA (que não existem)
function getRandomPhoto(index: number, genero: string): string {
  // Usar diferentes APIs de fotos realistas geradas por IA
  
  // Opção 1: Random User Generator - Fotos realistas de pessoas que não existem
  // Tem opção de gênero
  const gender = genero === "Feminino" ? "female" : "male";
  return `https://randomuser.me/api/portraits/${gender === "male" ? "men" : "women"}/${(index % 99) + 1}.jpg`;
  
  // Alternativa: Generated Photos API (requer seed único)
  // return `https://api.generated.photos/api/v1/faces?order_by=random&gender=${gender}&age=adult`;
}

async function main() {
  console.log('🚀 Atualizando motoristas existentes com fotos realistas...');

  // Buscar todos os motoristas
  const motoristas = await prisma.motorista.findMany();

  console.log(`📊 Encontrados ${motoristas.length} motoristas`);

  for (let i = 0; i < motoristas.length; i++) {
    const motorista = motoristas[i];
    try {
      // Dados padrão para preencher campos vazios
      const updates: any = {};

      // Determinar gênero primeiro (necessário para foto)
      let genero = motorista.genero;
      if (!genero) {
        // Alternar entre Masculino e Feminino
        genero = i % 2 === 0 ? "Masculino" : "Feminino";
        updates.genero = genero;
      }

      // Foto - sempre adicionar se não existir
      // Usar foto realista baseada no gênero
      if (!motorista.foto) {
        updates.foto = getRandomPhoto(i, genero);
      }

      // Campos de texto
      if (!motorista.nacionalidade) updates.nacionalidade = "Moçambicana";
      
      if (!motorista.estadoCivil) {
        const estados = ["Solteiro", "Casado", "Divorciado", "Viúvo"];
        updates.estadoCivil = estados[i % estados.length];
      }
      if (!motorista.categoriaCarta) updates.categoriaCarta = "B";
      
      // Campos numéricos
      if (motorista.experienciaAnos === null || motorista.experienciaAnos === undefined) {
        updates.experienciaAnos = Math.floor(Math.random() * 10) + 3; // 3-12 anos
      }

      // Contactos de emergência
      if (!motorista.numeroEmergencia) {
        updates.numeroEmergencia = "+258 84 " + Math.floor(Math.random() * 900 + 100) + " " + Math.floor(Math.random() * 9000 + 1000);
      }
      if (!motorista.contatoEmergencia) {
        const nomesMasculinos = ["João Costa", "Pedro Macamo", "Carlos Silva", "António Nhaca", "Manuel Santos"];
        const nomesFemininos = ["Maria Silva", "Ana Santos", "Isabel Nhaca", "Rosa Costa", "Beatriz Macamo"];
        const relacoes = genero === "Masculino" 
          ? ["Esposa", "Mãe", "Irmã"] 
          : ["Marido", "Pai", "Irmão"];
        
        const nomes = genero === "Masculino" ? nomesFemininos : nomesMasculinos;
        updates.contatoEmergencia = `${nomes[i % nomes.length]} (${relacoes[i % relacoes.length]})`;
      }

      // Datas de documentos
      const hoje = new Date();
      const anoAtual = hoje.getFullYear();
      
      if (!motorista.dataEmissaoBI) {
        const anosAtras = Math.floor(Math.random() * 5) + 1; // 1-5 anos atrás
        updates.dataEmissaoBI = new Date(anoAtual - anosAtras, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
      }
      
      if (!motorista.dataValidadeBI) {
        const emissaoBI = motorista.dataEmissaoBI || updates.dataEmissaoBI;
        updates.dataValidadeBI = new Date(new Date(emissaoBI).getFullYear() + 10, new Date(emissaoBI).getMonth(), new Date(emissaoBI).getDate());
      }

      if (!motorista.dataEmissaoCarta) {
        const anosAtras = Math.floor(Math.random() * 5) + 1; // 1-5 anos atrás
        updates.dataEmissaoCarta = new Date(anoAtual - anosAtras, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
      }
      
      if (!motorista.dataValidadeCarta) {
        const emissaoCarta = motorista.dataEmissaoCarta || updates.dataEmissaoCarta;
        updates.dataValidadeCarta = new Date(new Date(emissaoCarta).getFullYear() + 10, new Date(emissaoCarta).getMonth(), new Date(emissaoCarta).getDate());
      }

      // Só atualizar se houver campos para atualizar
      if (Object.keys(updates).length > 0) {
        await prisma.motorista.update({
          where: { id: motorista.id },
          data: updates,
        });
        console.log(`✅ Motorista atualizado: ${motorista.nome} (${Object.keys(updates).length} campos)`);
        if (updates.foto) {
          console.log(`   📸 Foto realista: ${updates.foto}`);
        }
      } else {
        console.log(`⏭️  Motorista já completo: ${motorista.nome}`);
      }
    } catch (error) {
      console.error(`❌ Erro ao atualizar motorista ${motorista.nome}:`, error);
    }
  }

  console.log('\n✨ Atualização concluída!');
  console.log('📸 Fotos realistas adicionadas usando Random User Generator');
  console.log('   - Fotos de pessoas que não existem');
  console.log('   - Baseadas no gênero do motorista');
  console.log('   - 99 fotos diferentes para homens');
  console.log('   - 99 fotos diferentes para mulheres');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
