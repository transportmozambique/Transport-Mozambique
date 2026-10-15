const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function recreateEmpresas() {
  try {
    console.log('=== RECRIANDO EMPRESAS PROPRIETÁRIAS ===\n');

    const empresas = [
      {
        nome: 'Transportes Maputo Lda',
        bi: '500000000',
        nacionalidade: 'Moçambicana',
        dataInicioOperacoes: new Date('1990-01-01'),
        endereco: 'Av. Julius Nyerere, 100, Maputo',
        contacto1: 21300000,
        contacto2: 21400000,
        tipoProprietario: 'Empresa',
        certificado: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      },
      {
        nome: 'Expresso Matola',
        bi: '500000002',
        nacionalidade: 'Moçambicana',
        dataInicioOperacoes: new Date('1992-01-01'),
        endereco: 'Av. Julius Nyerere, 200, Maputo',
        contacto1: 21300002,
        contacto2: 21400002,
        tipoProprietario: 'Empresa',
        certificado: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      },
      {
        nome: 'Transportes Baixa',
        bi: '500000003',
        nacionalidade: 'Moçambicana',
        dataInicioOperacoes: new Date('1993-01-01'),
        endereco: 'Av. 25 de Setembro, 150, Maputo',
        contacto1: 21300003,
        contacto2: null,
        tipoProprietario: 'Empresa',
        certificado: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      },
      {
        nome: 'Machava Express',
        bi: '500000004',
        nacionalidade: 'Moçambicana',
        dataInicioOperacoes: new Date('1994-01-01'),
        endereco: 'Av. Julius Nyerere, 300, Maputo',
        contacto1: 21300004,
        contacto2: 21400004,
        tipoProprietario: 'Empresa',
        certificado: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      },
      {
        nome: 'Transportes Polana',
        bi: '500000005',
        nacionalidade: 'Moçambicana',
        dataInicioOperacoes: new Date('1995-01-01'),
        endereco: 'Av. Julius Nyerere, 350, Maputo',
        contacto1: 21300005,
        contacto2: null,
        tipoProprietario: 'Empresa',
        certificado: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      },
      {
        nome: 'Via Verde Moçambique',
        bi: '500000006',
        nacionalidade: 'Moçambicana',
        dataInicioOperacoes: new Date('1996-01-01'),
        endereco: 'Av. Julius Nyerere, 400, Maputo',
        contacto1: 21300006,
        contacto2: 21400006,
        tipoProprietario: 'Empresa',
        certificado: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      },
      {
        nome: 'Transportes Sommerschield',
        bi: '500000007',
        nacionalidade: 'Moçambicana',
        dataInicioOperacoes: new Date('1997-01-01'),
        endereco: 'Av. Julius Nyerere, 450, Maputo',
        contacto1: 21300007,
        contacto2: null,
        tipoProprietario: 'Empresa',
        certificado: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      },
      {
        nome: 'Expresso Marginal',
        bi: '500000008',
        nacionalidade: 'Moçambicana',
        dataInicioOperacoes: new Date('1998-01-01'),
        endereco: 'Av. Julius Nyerere, 500, Maputo',
        contacto1: 21300008,
        contacto2: 21400008,
        tipoProprietario: 'Empresa',
        certificado: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      },
      {
        nome: 'Via Azul Transportes',
        bi: '500000009',
        nacionalidade: 'Moçambicana',
        dataInicioOperacoes: new Date('1999-01-01'),
        endereco: 'Av. Julius Nyerere, 550, Maputo',
        contacto1: 21300009,
        contacto2: null,
        tipoProprietario: 'Empresa',
        certificado: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      },
      {
        nome: 'Via Rápida Transportes',
        bi: '500000010',
        nacionalidade: 'Moçambicana',
        dataInicioOperacoes: new Date('2000-01-01'),
        endereco: 'Av. Julius Nyerere, 600, Maputo',
        contacto1: 21300010,
        contacto2: 21400010,
        tipoProprietario: 'Empresa',
        certificado: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      },
      {
        nome: 'Transportes Costa do Sol',
        bi: '500000011',
        nacionalidade: 'Moçambicana',
        dataInicioOperacoes: new Date('2001-01-01'),
        endereco: 'Av. Marginal, 100, Maputo',
        contacto1: 21300011,
        contacto2: null,
        tipoProprietario: 'Empresa',
        certificado: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
      }
    ];

    for (const empresa of empresas) {
      await prisma.$executeRaw`
        INSERT INTO "Proprietario" (
          id, nome, bi, nacionalidade, "dataInicioOperacoes", endereco, 
          contacto1, contacto2, "tipoProprietario", certificado, "createdAt", "updatedAt"
        )
        VALUES (
          gen_random_uuid(), ${empresa.nome}, ${empresa.bi}, ${empresa.nacionalidade}, 
          ${empresa.dataInicioOperacoes}, ${empresa.endereco}, ${empresa.contacto1}, 
          ${empresa.contacto2}, ${empresa.tipoProprietario}, ${empresa.certificado}, 
          NOW(), NOW()
        )
      `;
      console.log(`✓ ${empresa.nome} - Criada`);
    }

    console.log(`\n✅ ${empresas.length} empresas criadas com sucesso!\n`);

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

recreateEmpresas();
