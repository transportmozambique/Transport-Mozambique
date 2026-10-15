import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const motorista = await prisma.motorista.findFirst({
    include: {
      transporte: {
        include: {
          via: true,
          proprietarios: {
            include: {
              proprietario: true
            }
          }
        }
      }
    }
  });

  if (!motorista) {
    console.log('❌ Nenhum motorista encontrado');
    return;
  }

  console.log('✅ MOTORISTA COMPLETO:\n');
  console.log('Nome:', motorista.nome);
  console.log('BI:', motorista.bi);
  console.log('Carta:', motorista.cartaConducao);
  console.log('Telefone:', motorista.telefone);
  console.log('Email:', motorista.email);
  console.log('Data Nascimento:', motorista.dataNascimento);
  console.log('Endereço:', motorista.endereco);
  console.log('Foto:', motorista.foto);
  console.log('Nacionalidade:', motorista.nacionalidade);
  console.log('Género:', motorista.genero);
  console.log('Estado Civil:', motorista.estadoCivil);
  console.log('Número Emergência:', motorista.numeroEmergencia);
  console.log('Contacto Emergência:', motorista.contatoEmergencia);
  console.log('Deficiência:', motorista.deficiencia || 'Nenhuma');
  console.log('Data Emissão BI:', motorista.dataEmissaoBI);
  console.log('Data Validade BI:', motorista.dataValidadeBI);
  console.log('Data Emissão Carta:', motorista.dataEmissaoCarta);
  console.log('Data Validade Carta:', motorista.dataValidadeCarta);
  console.log('Categoria Carta:', motorista.categoriaCarta);
  console.log('Experiência Anos:', motorista.experienciaAnos);
  console.log('Observações:', motorista.observacoes || 'Nenhuma');
  console.log('Status:', motorista.status);
  console.log('Created At:', motorista.createdAt);
  
  if (motorista.transporte) {
    console.log('\n🚌 TRANSPORTE:');
    console.log('Matrícula:', motorista.transporte.matricula);
    console.log('Marca:', motorista.transporte.marca);
    console.log('Modelo:', motorista.transporte.modelo);
    console.log('Via:', motorista.transporte.via?.nome);
    
    if (motorista.transporte.proprietarios.length > 0) {
      console.log('\n🏢 EMPRESA:');
      console.log('Nome:', motorista.transporte.proprietarios[0].proprietario.nome);
      console.log('BI/NUIT:', motorista.transporte.proprietarios[0].proprietario.bi);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
