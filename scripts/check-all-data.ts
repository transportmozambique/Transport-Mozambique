import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📊 VERIFICANDO TODOS OS DADOS NA BASE DE DADOS\n');
  
  const paragens = await prisma.paragem.count();
  const vias = await prisma.via.count();
  const transportes = await prisma.transporte.count();
  const proprietarios = await prisma.proprietario.count();
  const motoristas = await prisma.motorista.count();
  const utentes = await prisma.utente.count();
  const viaParagens = await prisma.viaParagem.count();
  
  console.log('Paragens:', paragens);
  console.log('Vias:', vias);
  console.log('ViaParagens (relações):', viaParagens);
  console.log('Transportes:', transportes);
  console.log('Proprietários:', proprietarios);
  console.log('Motoristas:', motoristas);
  console.log('Utentes:', utentes);
  
  console.log('\n⚠️  PROBLEMA DETECTADO:');
  if (paragens === 0) {
    console.log('❌ Todas as paragens foram deletadas!');
    console.log('❌ Os dados originais foram perdidos na migração!');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
