const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const empresas = [
  { nome: "Transportes Maputo Lda", bi: "100000000001A", nacionalidade: "Moçambicana", endereco: "Av. Julius Nyerere, 1234, Maputo", contacto1: 21300001, contacto2: 84000001, certificado: "https://example.com/cert1.pdf", foto: "https://images.pexels.com/photos/1181396/pexels-photo-1181396.jpeg" },
  { nome: "Rota Sul Transportes", bi: "100000000002B", nacionalidade: "Moçambicana", endereco: "Av. Eduardo Mondlane, 567, Maputo", contacto1: 21300002, contacto2: 84000002, certificado: "https://example.com/cert2.pdf", foto: "https://images.pexels.com/photos/1181345/pexels-photo-1181345.jpeg" },
  { nome: "Expresso Matola", bi: "100000000003C", nacionalidade: "Moçambicana", endereco: "Rua da Matola, 890, Matola", contacto1: 21400001, contacto2: 84000003, certificado: "https://example.com/cert3.pdf", foto: "https://images.pexels.com/photos/1181354/pexels-photo-1181354.jpeg" },
  { nome: "Transportes Machava", bi: "100000000004D", nacionalidade: "Moçambicana", endereco: "Av. de Moçambique, 234, Machava", contacto1: 21400002, contacto2: 84000004, certificado: "https://example.com/cert4.pdf", foto: "https://images.pexels.com/photos/1181406/pexels-photo-1181406.jpeg" },
  { nome: "Via Rápida Transportes", bi: "100000000005E", nacionalidade: "Moçambicana", endereco: "Rua dos Desportistas, 456, Maputo", contacto1: 21300003, contacto2: 84000005, certificado: "https://example.com/cert5.pdf", foto: "https://images.pexels.com/photos/1181424/pexels-photo-1181424.jpeg" },
  { nome: "Chapas Unidas Lda", bi: "100000000006F", nacionalidade: "Moçambicana", endereco: "Av. 24 de Julho, 789, Maputo", contacto1: 21300004, contacto2: 84000006, certificado: "https://example.com/cert6.pdf", foto: "https://images.pexels.com/photos/1181467/pexels-photo-1181467.jpeg" },
  { nome: "Transporte Popular", bi: "100000000007G", nacionalidade: "Moçambicana", endereco: "Rua da Resistência, 123, Matola", contacto1: 21400003, contacto2: 84000007, certificado: "https://example.com/cert7.pdf", foto: "https://images.pexels.com/photos/1181533/pexels-photo-1181533.jpeg" },
  { nome: "Cidade em Movimento", bi: "100000000008H", nacionalidade: "Moçambicana", endereco: "Av. Samora Machel, 456, Maputo", contacto1: 21300005, contacto2: 84000008, certificado: "https://example.com/cert8.pdf", foto: "https://images.pexels.com/photos/1181562/pexels-photo-1181562.jpeg" },
  { nome: "Transportes Katembe", bi: "100000000009I", nacionalidade: "Moçambicana", endereco: "Av. da Marginal, 789, Katembe", contacto1: 21300006, contacto2: 84000009, certificado: "https://example.com/cert9.pdf", foto: "https://images.pexels.com/photos/1181605/pexels-photo-1181605.jpeg" },
  { nome: "Rota Norte Expresso", bi: "100000000010J", nacionalidade: "Moçambicana", endereco: "Rua do Bagamoyo, 234, Maputo", contacto1: 21300007, contacto2: 84000010, certificado: "https://example.com/cert10.pdf", foto: "https://images.pexels.com/photos/1181622/pexels-photo-1181622.jpeg" },
  { nome: "Transportes Limpopo", bi: "100000000011K", nacionalidade: "Moçambicana", endereco: "Av. Vladimir Lenine, 567, Maputo", contacto1: 21300008, contacto2: 84000011, certificado: "https://example.com/cert11.pdf", foto: "https://images.pexels.com/photos/1181677/pexels-photo-1181677.jpeg" }
];

async function createProprietarios() {
  console.log('\n🏢 Creating 11 Proprietários (Empresas)...\n');
  
  try {
    for (let i = 0; i < empresas.length; i++) {
      const empresa = empresas[i];
      
      // Set birthDate to a date between 2010-2020
      const year = 2010 + (i % 11);
      const month = Math.floor(Math.random() * 12);
      const day = Math.floor(Math.random() * 28) + 1;
      const birthDate = new Date(year, month, day);
      
      await prisma.proprietario.create({
        data: {
          ...empresa,
          birthDate,
          tipoProprietario: "Empresa"
        }
      });
      
      console.log(`✅ ${i + 1}/11 - ${empresa.nome}`);
    }
    
    console.log('\n✅ All 11 proprietários created successfully!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createProprietarios();
