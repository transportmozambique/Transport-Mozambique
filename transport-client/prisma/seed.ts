import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed da base de dados...');

  // Limpar dados existentes
  await prisma.geoLocation.deleteMany();
  await prisma.mISSION.deleteMany();
  await prisma.motorista.deleteMany();
  await prisma.transporteProprietario.deleteMany();
  await prisma.transporte.deleteMany();
  await prisma.proprietario.deleteMany();
  await prisma.viaParagem.deleteMany();
  await prisma.paragem.deleteMany();
  await prisma.via.deleteMany();
  await prisma.municipio.deleteMany();
  await prisma.cidade.deleteMany();
  await prisma.provincia.deleteMany();
  await prisma.utente.deleteMany();
  await prisma.administrador.deleteMany();

  // Criar Administrador
  const admin = await prisma.administrador.create({
    data: {
      nome: 'Administrador Sistema',
      email: 'admin@transportmz.com',
      senha: 'admin123', // Em produção, usar hash
    },
  });

  console.log('✅ Administrador criado');

  // Criar Províncias
  const maputo = await prisma.provincia.create({
    data: {
      nome: 'Maputo',
      geoLocation: '-25.9692,32.5732',
      codigo: 'MP',
      administradorId: admin.id,
    },
  });

  const gaza = await prisma.provincia.create({
    data: {
      nome: 'Gaza',
      geoLocation: '-24.7042,33.6292',
      codigo: 'GZ',
      administradorId: admin.id,
    },
  });

  console.log('✅ Províncias criadas');

  // Criar Cidades
  const cidadeMaputo = await prisma.cidade.create({
    data: {
      nome: 'Cidade de Maputo',
      localizacao: '-25.9692,32.5732',
      codigo: 'CM',
      codigoProvinciaString: 'MP',
      provinciaId: maputo.id,
    },
  });

  const matola = await prisma.cidade.create({
    data: {
      nome: 'Matola',
      localizacao: '-25.9622,32.4589',
      codigo: 'MT',
      codigoProvinciaString: 'MP',
      provinciaId: maputo.id,
    },
  });

  console.log('✅ Cidades criadas');

  // Criar Municípios
  const municipioMaputo = await prisma.municipio.create({
    data: {
      nome: 'Maputo',
      codigo: 'MUN-MP-01',
      endereco: 'Av. Julius Nyerere',
      contacto1: 842345678,
      provinciaId: maputo.id,
      cidadeId: cidadeMaputo.id,
      administradorId: admin.id,
    },
  });

  const municipioMatola = await prisma.municipio.create({
    data: {
      nome: 'Matola',
      codigo: 'MUN-MT-01',
      endereco: 'Av. da Independência',
      contacto1: 843456789,
      provinciaId: maputo.id,
      cidadeId: matola.id,
      administradorId: admin.id,
    },
  });

  console.log('✅ Municípios criados');

  // Criar Vias baseadas nas rotas oficiais da EMTPM 2025
  
  // Rota 1a: Baixa - Chamissava (via Katembe)
  const via1a = await prisma.via.create({
    data: {
      nome: 'Rota 1a: Baixa - Chamissava',
      codigo: 'VIA-1A',
      cor: '#2563eb',
      terminalPartida: 'Praça dos Trabalhadores',
      terminalChegada: 'Chamissava',
      geoLocationPath: '32.5694,-25.9734;32.5594,-25.9861;32.5186,-26.0371',
      codigoMunicipio: 'MUN-MP-01',
      municipioId: municipioMaputo.id,
      administradorId: admin.id,
    },
  });

  // Rota 11: Baixa - Michafutene (via Jardim)
  const via11 = await prisma.via.create({
    data: {
      nome: 'Rota 11: Baixa - Michafutene',
      codigo: 'VIA-11',
      cor: '#10b981',
      terminalPartida: 'Albert Lithule',
      terminalChegada: 'Michafutene',
      geoLocationPath: '32.5694,-25.9734;32.5714,-25.9688;32.6189,-25.8092',
      codigoMunicipio: 'MUN-MP-01',
      municipioId: municipioMaputo.id,
      administradorId: admin.id,
    },
  });

  // Rota 17: Baixa - Zimpeto (via Costa do Sol)
  const via17 = await prisma.via.create({
    data: {
      nome: 'Rota 17: Baixa - Zimpeto',
      codigo: 'VIA-17',
      cor: '#f59e0b',
      terminalPartida: 'Praça dos Trabalhadores',
      terminalChegada: 'Terminal Zimpeto',
      geoLocationPath: '32.5694,-25.9734;32.6347,-25.9189;32.6184,-25.9525;32.6186,-25.8643',
      codigoMunicipio: 'MUN-MP-01',
      municipioId: municipioMaputo.id,
      administradorId: admin.id,
    },
  });

  // Rota 20: Baixa - Matendene (via Jardim)
  const via20 = await prisma.via.create({
    data: {
      nome: 'Rota 20: Baixa - Matendene',
      codigo: 'VIA-20',
      cor: '#ef4444',
      terminalPartida: 'Albert Lithule',
      terminalChegada: 'Matendene',
      geoLocationPath: '32.5694,-25.9734;32.5714,-25.9688;32.6315,-25.8264',
      codigoMunicipio: 'MUN-MP-01',
      municipioId: municipioMaputo.id,
      administradorId: admin.id,
    },
  });

  // Rota 21: Museu - Albasine (via Dom Alexandre)
  const via21 = await prisma.via.create({
    data: {
      nome: 'Rota 21: Museu - Albasine',
      codigo: 'VIA-21',
      cor: '#8b5cf6',
      terminalPartida: 'Terminal Museu',
      terminalChegada: 'Albasine',
      geoLocationPath: '32.5836,-25.9723;32.6056,-25.9419;32.6382,-25.8373',
      codigoMunicipio: 'MUN-MP-01',
      municipioId: municipioMaputo.id,
      administradorId: admin.id,
    },
  });

  // Rota 37: Museu - Zimpeto (via Jardim)
  const via37 = await prisma.via.create({
    data: {
      nome: 'Rota 37: Museu - Zimpeto',
      codigo: 'VIA-37',
      cor: '#ec4899',
      terminalPartida: 'Terminal Museu',
      terminalChegada: 'Terminal Zimpeto',
      geoLocationPath: '32.5836,-25.9723;32.5714,-25.9688;32.6186,-25.8643',
      codigoMunicipio: 'MUN-MP-01',
      municipioId: municipioMaputo.id,
      administradorId: admin.id,
    },
  });

  // Rota 39a: Baixa - Zimpeto (via Jardim)
  const via39a = await prisma.via.create({
    data: {
      nome: 'Rota 39a: Baixa - Zimpeto',
      codigo: 'VIA-39A',
      cor: '#06b6d4',
      terminalPartida: 'Albert Lithule',
      terminalChegada: 'Terminal Zimpeto',
      geoLocationPath: '32.5694,-25.9734;32.5639,-25.9442;32.6382,-25.8373;32.6186,-25.8643',
      codigoMunicipio: 'MUN-MP-01',
      municipioId: municipioMaputo.id,
      administradorId: admin.id,
    },
  });

  // Rota 39b: Baixa - Boquisso (via Jardim)
  const via39b = await prisma.via.create({
    data: {
      nome: 'Rota 39b: Baixa - Boquisso',
      codigo: 'VIA-39B',
      cor: '#84cc16',
      terminalPartida: 'Albert Lithule',
      terminalChegada: 'Boquisso',
      geoLocationPath: '32.5694,-25.9734;32.5714,-25.9688;32.5410,-25.8160',
      codigoMunicipio: 'MUN-MP-01',
      municipioId: municipioMaputo.id,
      administradorId: admin.id,
    },
  });

  // Rota 47: Baixa - Tchumene (via Portagem)
  const via47 = await prisma.via.create({
    data: {
      nome: 'Rota 47: Baixa - Tchumene',
      codigo: 'VIA-47',
      cor: '#f97316',
      terminalPartida: 'Albert Lithule',
      terminalChegada: 'Tchumene',
      geoLocationPath: '32.5694,-25.9734;32.5147,-25.9392;32.4042,-25.8856',
      codigoMunicipio: 'MUN-MP-01',
      municipioId: municipioMaputo.id,
      administradorId: admin.id,
    },
  });

  // Rota 51a: Baixa - Boane (via Portagem)
  const via51a = await prisma.via.create({
    data: {
      nome: 'Rota 51a: Baixa - Boane',
      codigo: 'VIA-51A',
      cor: '#14b8a6',
      terminalPartida: 'Zedequias Manganhela',
      terminalChegada: 'Boane',
      geoLocationPath: '32.5694,-25.9734;32.5147,-25.9392;32.3275,-26.0428',
      codigoMunicipio: 'MUN-MP-01',
      municipioId: municipioMaputo.id,
      administradorId: admin.id,
    },
  });

  // Rota 51c: Baixa - Mafuiane (via Portagem)
  const via51c = await prisma.via.create({
    data: {
      nome: 'Rota 51c: Baixa - Mafuiane',
      codigo: 'VIA-51C',
      cor: '#a855f7',
      terminalPartida: 'Zedequias Manganhela',
      terminalChegada: 'Mafuiane',
      geoLocationPath: '32.5694,-25.9734;32.5147,-25.9392;32.2222,-26.0375',
      codigoMunicipio: 'MUN-MP-01',
      municipioId: municipioMaputo.id,
      administradorId: admin.id,
    },
  });

  // Rota 53: Baixa - Albasine (via Hulene)
  const via53 = await prisma.via.create({
    data: {
      nome: 'Rota 53: Baixa - Albasine',
      codigo: 'VIA-53',
      cor: '#eab308',
      terminalPartida: 'Laurentina',
      terminalChegada: 'Albasine',
      geoLocationPath: '32.5694,-25.9734;32.5939,-25.9083;32.6382,-25.8373',
      codigoMunicipio: 'MUN-MP-01',
      municipioId: municipioMaputo.id,
      administradorId: admin.id,
    },
  });

  // ROTAS DA MATOLA
  
  // Rota: Matola Sede - Museu (via N4)
  const viaMatolaMuseu = await prisma.via.create({
    data: {
      nome: 'Matola Sede - Museu',
      codigo: 'VIA-MAT-MUS',
      cor: '#6366f1',
      terminalPartida: 'Terminal Matola Sede',
      terminalChegada: 'Terminal Museu',
      geoLocationPath: '32.4589,-25.9794;32.4655,-25.9528;32.5147,-25.9392;32.5836,-25.9723',
      codigoMunicipio: 'MUN-MT-01',
      municipioId: municipioMatola.id,
      administradorId: admin.id,
    },
  });

  // Rota: Matola Sede - Baixa (via N4/Portagem)
  const viaMatolaBaixa = await prisma.via.create({
    data: {
      nome: 'Matola Sede - Baixa',
      codigo: 'VIA-MAT-BAI',
      cor: '#0ea5e9',
      terminalPartida: 'Terminal Matola Sede',
      terminalChegada: 'Praça dos Trabalhadores',
      geoLocationPath: '32.4589,-25.9794;32.4612,-25.9658;32.5147,-25.9392;32.5694,-25.9734',
      codigoMunicipio: 'MUN-MT-01',
      municipioId: municipioMatola.id,
      administradorId: admin.id,
    },
  });

  // Rota: Tchumene - Baixa (via N4)
  const viaTchumeneBaixa = await prisma.via.create({
    data: {
      nome: 'Tchumene - Baixa',
      codigo: 'VIA-TCH-BAI',
      cor: '#f43f5e',
      terminalPartida: 'Tchumene',
      terminalChegada: 'Praça dos Trabalhadores',
      geoLocationPath: '32.4042,-25.8856;32.4336,-25.8885;32.5147,-25.9392;32.5694,-25.9734',
      codigoMunicipio: 'MUN-MT-01',
      municipioId: municipioMatola.id,
      administradorId: admin.id,
    },
  });

  // Rota: Malhampsene - Museu (via N4)
  const viaMalhampseneMuseu = await prisma.via.create({
    data: {
      nome: 'Malhampsene - Museu',
      codigo: 'VIA-MAL-MUS',
      cor: '#22c55e',
      terminalPartida: 'Terminal Malhampsene',
      terminalChegada: 'Terminal Museu',
      geoLocationPath: '32.4336,-25.8885;32.4512,-25.8271;32.5147,-25.9392;32.5836,-25.9723',
      codigoMunicipio: 'MUN-MT-01',
      municipioId: municipioMatola.id,
      administradorId: admin.id,
    },
  });

  // Rota: Matola Gare - Baixa
  const viaMatolaGareBaixa = await prisma.via.create({
    data: {
      nome: 'Matola Gare - Baixa',
      codigo: 'VIA-MGARE-BAI',
      cor: '#a855f7',
      terminalPartida: 'Terminal Matola Gare',
      terminalChegada: 'Praça dos Trabalhadores',
      geoLocationPath: '32.4512,-25.8271;32.4336,-25.8885;32.5147,-25.9392;32.5694,-25.9734',
      codigoMunicipio: 'MUN-MT-01',
      municipioId: municipioMatola.id,
      administradorId: admin.id,
    },
  });

  // Rota: Machava Sede - Museu
  const viaMachavaMuseu = await prisma.via.create({
    data: {
      nome: 'Machava Sede - Museu',
      codigo: 'VIA-MACH-MUS',
      cor: '#fb923c',
      terminalPartida: 'Machava Sede',
      terminalChegada: 'Terminal Museu',
      geoLocationPath: '32.4914,-25.9125;32.4792,-25.9255;32.5147,-25.9392;32.5836,-25.9723',
      codigoMunicipio: 'MUN-MT-01',
      municipioId: municipioMatola.id,
      administradorId: admin.id,
    },
  });

  console.log('✅ Vias criadas');

  // Criar Paragens baseadas nos terminais e paragens reais de Maputo (EMTPM 2025)
  
  // Terminais Principais - Maputo Centro
  const paragemBaixa = await prisma.paragem.create({
    data: {
      nome: 'Praça dos Trabalhadores (Baixa)',
      codigo: 'PAR-BAIXA',
      geoLocation: '-25.9734,32.5694',
      administradorId: admin.id,
    },
  });

  const paragemAlbertLithule = await prisma.paragem.create({
    data: {
      nome: 'Albert Lithule',
      codigo: 'PAR-ALBERT',
      geoLocation: '-25.9734,32.5694', // Próximo à Baixa
      administradorId: admin.id,
    },
  });

  const paragemLaurentina = await prisma.paragem.create({
    data: {
      nome: 'Laurentina',
      codigo: 'PAR-LAURENT',
      geoLocation: '-25.9734,32.5694', // Próximo à Baixa
      administradorId: admin.id,
    },
  });

  const paragemMuseu = await prisma.paragem.create({
    data: {
      nome: 'Terminal Museu',
      codigo: 'PAR-MUSEU',
      geoLocation: '-25.9723,32.5836',
      administradorId: admin.id,
    },
  });

  // Terminais Norte
  const paragemZimpeto = await prisma.paragem.create({
    data: {
      nome: 'Terminal Zimpeto',
      codigo: 'PAR-ZIMPETO',
      geoLocation: '-25.8643,32.6186',
      administradorId: admin.id,
    },
  });

  const paragemMichafutene = await prisma.paragem.create({
    data: {
      nome: 'Michafutene',
      codigo: 'PAR-MICHAF',
      geoLocation: '-25.8092,32.6189',
      administradorId: admin.id,
    },
  });

  const paragemMatendene = await prisma.paragem.create({
    data: {
      nome: 'Matendene',
      codigo: 'PAR-MATEND',
      geoLocation: '-25.8264,32.6315',
      administradorId: admin.id,
    },
  });

  // Terminais Sul (Katembe)
  const paragemChamissava = await prisma.paragem.create({
    data: {
      nome: 'Chamissava',
      codigo: 'PAR-CHAMIS',
      geoLocation: '-26.0371,32.5186',
      administradorId: admin.id,
    },
  });

  const paragemKatembe = await prisma.paragem.create({
    data: {
      nome: 'Terminal Katembe',
      codigo: 'PAR-KATEMBE',
      geoLocation: '-25.9861,32.5594',
      administradorId: admin.id,
    },
  });

  // Terminais Oeste (Matola/Boane)
  const paragemTchumene = await prisma.paragem.create({
    data: {
      nome: 'Tchumene',
      codigo: 'PAR-TCHUM',
      geoLocation: '-25.8856,32.4042',
      administradorId: admin.id,
    },
  });

  const paragemBoane = await prisma.paragem.create({
    data: {
      nome: 'Boane',
      codigo: 'PAR-BOANE',
      geoLocation: '-26.0428,32.3275',
      administradorId: admin.id,
    },
  });

  const paragemMafuiane = await prisma.paragem.create({
    data: {
      nome: 'Mafuiane',
      codigo: 'PAR-MAFUI',
      geoLocation: '-26.0375,32.2222',
      administradorId: admin.id,
    },
  });

  const paragemPortagem = await prisma.paragem.create({
    data: {
      nome: 'Portagem (Matola)',
      codigo: 'PAR-PORTAG',
      geoLocation: '-25.9392,32.5147',
      administradorId: admin.id,
    },
  });

  const paragemBoquisso = await prisma.paragem.create({
    data: {
      nome: 'Boquisso',
      codigo: 'PAR-BOQUIS',
      geoLocation: '-25.8160,32.5410',
      administradorId: admin.id,
    },
  });

  // Paragens Importantes - Bairros
  const paragemAlbazine = await prisma.paragem.create({
    data: {
      nome: 'Albasine (Rotunda)',
      codigo: 'PAR-ALBAZINE',
      geoLocation: '-25.8373,32.6382',
      administradorId: admin.id,
    },
  });

  const paragemXipamanine = await prisma.paragem.create({
    data: {
      nome: 'Xipamanine',
      codigo: 'PAR-XIPAMA',
      geoLocation: '-25.9442,32.5639',
      administradorId: admin.id,
    },
  });

  const paragemJardim = await prisma.paragem.create({
    data: {
      nome: 'Jardim',
      codigo: 'PAR-JARDIM',
      geoLocation: '-25.9688,32.5714',
      administradorId: admin.id,
    },
  });

  const paragemCostaSol = await prisma.paragem.create({
    data: {
      nome: 'Costa do Sol',
      codigo: 'PAR-COSTASOL',
      geoLocation: '-25.9189,32.6347',
      administradorId: admin.id,
    },
  });

  const paragemPraia = await prisma.paragem.create({
    data: {
      nome: 'Paragem Praia',
      codigo: 'PAR-PRAIA',
      geoLocation: '-25.9525,32.6184',
      administradorId: admin.id,
    },
  });

  const paragemHulene = await prisma.paragem.create({
    data: {
      nome: 'Hulene (Praça)',
      codigo: 'PAR-HULENE',
      geoLocation: '-25.9083,32.5939',
      administradorId: admin.id,
    },
  });

  const paragemDomAlexandre = await prisma.paragem.create({
    data: {
      nome: 'Dom Alexandre',
      codigo: 'PAR-DOMALEX',
      geoLocation: '-25.9419,32.6056',
      administradorId: admin.id,
    },
  });

  const paragemRadioMarcone = await prisma.paragem.create({
    data: {
      nome: 'Rádio Marcone',
      codigo: 'PAR-MARCONE',
      geoLocation: '-25.9224,32.5831',
      administradorId: admin.id,
    },
  });

  // PARAGENS DA MATOLA
  
  const paragemMatolaSede = await prisma.paragem.create({
    data: {
      nome: 'Terminal Matola Sede (Hanhane)',
      codigo: 'PAR-MATSEDE',
      geoLocation: '-25.9794,32.4589',
      administradorId: admin.id,
    },
  });

  const paragemMalhampsene = await prisma.paragem.create({
    data: {
      nome: 'Terminal de Malhampsene',
      codigo: 'PAR-MALHAM',
      geoLocation: '-25.8885,32.4336',
      administradorId: admin.id,
    },
  });

  const paragemMatolaGare = await prisma.paragem.create({
    data: {
      nome: 'Matola Gare (Estação)',
      codigo: 'PAR-MGARE',
      geoLocation: '-25.8271,32.4512',
      administradorId: admin.id,
    },
  });

  const paragemLiberdade = await prisma.paragem.create({
    data: {
      nome: 'Liberdade (Paragem)',
      codigo: 'PAR-LIBERDADE',
      geoLocation: '-25.9067,32.4695',
      administradorId: admin.id,
    },
  });

  const paragemMachavaSocimol = await prisma.paragem.create({
    data: {
      nome: 'Machava Socimol',
      codigo: 'PAR-MACHSOC',
      geoLocation: '-25.9255,32.4792',
      administradorId: admin.id,
    },
  });

  const paragemMachavaSede = await prisma.paragem.create({
    data: {
      nome: 'Machava Sede',
      codigo: 'PAR-MACHSEDE',
      geoLocation: '-25.9125,32.4914',
      administradorId: admin.id,
    },
  });

  const paragemGodinho = await prisma.paragem.create({
    data: {
      nome: 'Godinho (Cruzamento)',
      codigo: 'PAR-GODINHO',
      geoLocation: '-25.9528,32.4655',
      administradorId: admin.id,
    },
  });

  const paragemShoprite = await prisma.paragem.create({
    data: {
      nome: 'Paragem da Shoprite (Matola)',
      codigo: 'PAR-SHOPRITE',
      geoLocation: '-25.9658,32.4612',
      administradorId: admin.id,
    },
  });

  const paragemBombas = await prisma.paragem.create({
    data: {
      nome: 'Paragem das Bombas (N4)',
      codigo: 'PAR-BOMBAS',
      geoLocation: '-25.9320,32.5050',
      administradorId: admin.id,
    },
  });

  const paragemSantos = await prisma.paragem.create({
    data: {
      nome: 'Paragem da Santos',
      codigo: 'PAR-SANTOS',
      geoLocation: '-25.9415,32.4638',
      administradorId: admin.id,
    },
  });

  console.log('✅ Paragens criadas');

  // Associar Paragens às Vias (EMTPM 2025)
  await prisma.viaParagem.createMany({
    data: [
      // Rota 1a: Baixa - Chamissava
      { codigoParagem: 'PAR-BAIXA', codigoVia: 'VIA-1A', viaId: via1a.id, paragemId: paragemBaixa.id, terminalBoolean: true },
      { codigoParagem: 'PAR-KATEMBE', codigoVia: 'VIA-1A', viaId: via1a.id, paragemId: paragemKatembe.id, terminalBoolean: false },
      { codigoParagem: 'PAR-CHAMIS', codigoVia: 'VIA-1A', viaId: via1a.id, paragemId: paragemChamissava.id, terminalBoolean: true },
      
      // Rota 11: Baixa - Michafutene
      { codigoParagem: 'PAR-ALBERT', codigoVia: 'VIA-11', viaId: via11.id, paragemId: paragemAlbertLithule.id, terminalBoolean: true },
      { codigoParagem: 'PAR-JARDIM', codigoVia: 'VIA-11', viaId: via11.id, paragemId: paragemJardim.id, terminalBoolean: false },
      { codigoParagem: 'PAR-MICHAF', codigoVia: 'VIA-11', viaId: via11.id, paragemId: paragemMichafutene.id, terminalBoolean: true },
      
      // Rota 17: Baixa - Zimpeto (via Costa do Sol)
      { codigoParagem: 'PAR-BAIXA', codigoVia: 'VIA-17', viaId: via17.id, paragemId: paragemBaixa.id, terminalBoolean: true },
      { codigoParagem: 'PAR-COSTASOL', codigoVia: 'VIA-17', viaId: via17.id, paragemId: paragemCostaSol.id, terminalBoolean: false },
      { codigoParagem: 'PAR-PRAIA', codigoVia: 'VIA-17', viaId: via17.id, paragemId: paragemPraia.id, terminalBoolean: false },
      { codigoParagem: 'PAR-ZIMPETO', codigoVia: 'VIA-17', viaId: via17.id, paragemId: paragemZimpeto.id, terminalBoolean: true },
      
      // Rota 20: Baixa - Matendene
      { codigoParagem: 'PAR-ALBERT', codigoVia: 'VIA-20', viaId: via20.id, paragemId: paragemAlbertLithule.id, terminalBoolean: true },
      { codigoParagem: 'PAR-JARDIM', codigoVia: 'VIA-20', viaId: via20.id, paragemId: paragemJardim.id, terminalBoolean: false },
      { codigoParagem: 'PAR-MATEND', codigoVia: 'VIA-20', viaId: via20.id, paragemId: paragemMatendene.id, terminalBoolean: true },
      
      // Rota 21: Museu - Albasine (via Dom Alexandre)
      { codigoParagem: 'PAR-MUSEU', codigoVia: 'VIA-21', viaId: via21.id, paragemId: paragemMuseu.id, terminalBoolean: true },
      { codigoParagem: 'PAR-DOMALEX', codigoVia: 'VIA-21', viaId: via21.id, paragemId: paragemDomAlexandre.id, terminalBoolean: false },
      { codigoParagem: 'PAR-ALBAZINE', codigoVia: 'VIA-21', viaId: via21.id, paragemId: paragemAlbazine.id, terminalBoolean: true },
      
      // Rota 37: Museu - Zimpeto (via Jardim)
      { codigoParagem: 'PAR-MUSEU', codigoVia: 'VIA-37', viaId: via37.id, paragemId: paragemMuseu.id, terminalBoolean: true },
      { codigoParagem: 'PAR-JARDIM', codigoVia: 'VIA-37', viaId: via37.id, paragemId: paragemJardim.id, terminalBoolean: false },
      { codigoParagem: 'PAR-ZIMPETO', codigoVia: 'VIA-37', viaId: via37.id, paragemId: paragemZimpeto.id, terminalBoolean: true },
      
      // Rota 39a: Baixa - Zimpeto (via Jardim)
      { codigoParagem: 'PAR-ALBERT', codigoVia: 'VIA-39A', viaId: via39a.id, paragemId: paragemAlbertLithule.id, terminalBoolean: true },
      { codigoParagem: 'PAR-XIPAMA', codigoVia: 'VIA-39A', viaId: via39a.id, paragemId: paragemXipamanine.id, terminalBoolean: false },
      { codigoParagem: 'PAR-ALBAZINE', codigoVia: 'VIA-39A', viaId: via39a.id, paragemId: paragemAlbazine.id, terminalBoolean: false },
      { codigoParagem: 'PAR-ZIMPETO', codigoVia: 'VIA-39A', viaId: via39a.id, paragemId: paragemZimpeto.id, terminalBoolean: true },
      
      // Rota 39b: Baixa - Boquisso
      { codigoParagem: 'PAR-ALBERT', codigoVia: 'VIA-39B', viaId: via39b.id, paragemId: paragemAlbertLithule.id, terminalBoolean: true },
      { codigoParagem: 'PAR-JARDIM', codigoVia: 'VIA-39B', viaId: via39b.id, paragemId: paragemJardim.id, terminalBoolean: false },
      { codigoParagem: 'PAR-BOQUIS', codigoVia: 'VIA-39B', viaId: via39b.id, paragemId: paragemBoquisso.id, terminalBoolean: true },
      
      // Rota 47: Baixa - Tchumene
      { codigoParagem: 'PAR-ALBERT', codigoVia: 'VIA-47', viaId: via47.id, paragemId: paragemAlbertLithule.id, terminalBoolean: true },
      { codigoParagem: 'PAR-PORTAG', codigoVia: 'VIA-47', viaId: via47.id, paragemId: paragemPortagem.id, terminalBoolean: false },
      { codigoParagem: 'PAR-TCHUM', codigoVia: 'VIA-47', viaId: via47.id, paragemId: paragemTchumene.id, terminalBoolean: true },
      
      // Rota 51a: Baixa - Boane
      { codigoParagem: 'PAR-BAIXA', codigoVia: 'VIA-51A', viaId: via51a.id, paragemId: paragemBaixa.id, terminalBoolean: true },
      { codigoParagem: 'PAR-PORTAG', codigoVia: 'VIA-51A', viaId: via51a.id, paragemId: paragemPortagem.id, terminalBoolean: false },
      { codigoParagem: 'PAR-BOANE', codigoVia: 'VIA-51A', viaId: via51a.id, paragemId: paragemBoane.id, terminalBoolean: true },
      
      // Rota 51c: Baixa - Mafuiane
      { codigoParagem: 'PAR-BAIXA', codigoVia: 'VIA-51C', viaId: via51c.id, paragemId: paragemBaixa.id, terminalBoolean: true },
      { codigoParagem: 'PAR-PORTAG', codigoVia: 'VIA-51C', viaId: via51c.id, paragemId: paragemPortagem.id, terminalBoolean: false },
      { codigoParagem: 'PAR-MAFUI', codigoVia: 'VIA-51C', viaId: via51c.id, paragemId: paragemMafuiane.id, terminalBoolean: true },
      
      // Rota 53: Baixa - Albasine (via Hulene)
      { codigoParagem: 'PAR-LAURENT', codigoVia: 'VIA-53', viaId: via53.id, paragemId: paragemLaurentina.id, terminalBoolean: true },
      { codigoParagem: 'PAR-HULENE', codigoVia: 'VIA-53', viaId: via53.id, paragemId: paragemHulene.id, terminalBoolean: false },
      { codigoParagem: 'PAR-ALBAZINE', codigoVia: 'VIA-53', viaId: via53.id, paragemId: paragemAlbazine.id, terminalBoolean: true },
      
      // ROTAS DA MATOLA
      
      // Matola Sede - Museu
      { codigoParagem: 'PAR-MATSEDE', codigoVia: 'VIA-MAT-MUS', viaId: viaMatolaMuseu.id, paragemId: paragemMatolaSede.id, terminalBoolean: true },
      { codigoParagem: 'PAR-GODINHO', codigoVia: 'VIA-MAT-MUS', viaId: viaMatolaMuseu.id, paragemId: paragemGodinho.id, terminalBoolean: false },
      { codigoParagem: 'PAR-PORTAG', codigoVia: 'VIA-MAT-MUS', viaId: viaMatolaMuseu.id, paragemId: paragemPortagem.id, terminalBoolean: false },
      { codigoParagem: 'PAR-MUSEU', codigoVia: 'VIA-MAT-MUS', viaId: viaMatolaMuseu.id, paragemId: paragemMuseu.id, terminalBoolean: true },
      
      // Matola Sede - Baixa
      { codigoParagem: 'PAR-MATSEDE', codigoVia: 'VIA-MAT-BAI', viaId: viaMatolaBaixa.id, paragemId: paragemMatolaSede.id, terminalBoolean: true },
      { codigoParagem: 'PAR-SHOPRITE', codigoVia: 'VIA-MAT-BAI', viaId: viaMatolaBaixa.id, paragemId: paragemShoprite.id, terminalBoolean: false },
      { codigoParagem: 'PAR-PORTAG', codigoVia: 'VIA-MAT-BAI', viaId: viaMatolaBaixa.id, paragemId: paragemPortagem.id, terminalBoolean: false },
      { codigoParagem: 'PAR-BAIXA', codigoVia: 'VIA-MAT-BAI', viaId: viaMatolaBaixa.id, paragemId: paragemBaixa.id, terminalBoolean: true },
      
      // Tchumene - Baixa
      { codigoParagem: 'PAR-TCHUM', codigoVia: 'VIA-TCH-BAI', viaId: viaTchumeneBaixa.id, paragemId: paragemTchumene.id, terminalBoolean: true },
      { codigoParagem: 'PAR-MALHAM', codigoVia: 'VIA-TCH-BAI', viaId: viaTchumeneBaixa.id, paragemId: paragemMalhampsene.id, terminalBoolean: false },
      { codigoParagem: 'PAR-PORTAG', codigoVia: 'VIA-TCH-BAI', viaId: viaTchumeneBaixa.id, paragemId: paragemPortagem.id, terminalBoolean: false },
      { codigoParagem: 'PAR-BAIXA', codigoVia: 'VIA-TCH-BAI', viaId: viaTchumeneBaixa.id, paragemId: paragemBaixa.id, terminalBoolean: true },
      
      // Malhampsene - Museu
      { codigoParagem: 'PAR-MALHAM', codigoVia: 'VIA-MAL-MUS', viaId: viaMalhampseneMuseu.id, paragemId: paragemMalhampsene.id, terminalBoolean: true },
      { codigoParagem: 'PAR-MGARE', codigoVia: 'VIA-MAL-MUS', viaId: viaMalhampseneMuseu.id, paragemId: paragemMatolaGare.id, terminalBoolean: false },
      { codigoParagem: 'PAR-PORTAG', codigoVia: 'VIA-MAL-MUS', viaId: viaMalhampseneMuseu.id, paragemId: paragemPortagem.id, terminalBoolean: false },
      { codigoParagem: 'PAR-MUSEU', codigoVia: 'VIA-MAL-MUS', viaId: viaMalhampseneMuseu.id, paragemId: paragemMuseu.id, terminalBoolean: true },
      
      // Matola Gare - Baixa
      { codigoParagem: 'PAR-MGARE', codigoVia: 'VIA-MGARE-BAI', viaId: viaMatolaGareBaixa.id, paragemId: paragemMatolaGare.id, terminalBoolean: true },
      { codigoParagem: 'PAR-MALHAM', codigoVia: 'VIA-MGARE-BAI', viaId: viaMatolaGareBaixa.id, paragemId: paragemMalhampsene.id, terminalBoolean: false },
      { codigoParagem: 'PAR-PORTAG', codigoVia: 'VIA-MGARE-BAI', viaId: viaMatolaGareBaixa.id, paragemId: paragemPortagem.id, terminalBoolean: false },
      { codigoParagem: 'PAR-BAIXA', codigoVia: 'VIA-MGARE-BAI', viaId: viaMatolaGareBaixa.id, paragemId: paragemBaixa.id, terminalBoolean: true },
      
      // Machava Sede - Museu
      { codigoParagem: 'PAR-MACHSEDE', codigoVia: 'VIA-MACH-MUS', viaId: viaMachavaMuseu.id, paragemId: paragemMachavaSede.id, terminalBoolean: true },
      { codigoParagem: 'PAR-MACHSOC', codigoVia: 'VIA-MACH-MUS', viaId: viaMachavaMuseu.id, paragemId: paragemMachavaSocimol.id, terminalBoolean: false },
      { codigoParagem: 'PAR-PORTAG', codigoVia: 'VIA-MACH-MUS', viaId: viaMachavaMuseu.id, paragemId: paragemPortagem.id, terminalBoolean: false },
      { codigoParagem: 'PAR-MUSEU', codigoVia: 'VIA-MACH-MUS', viaId: viaMachavaMuseu.id, paragemId: paragemMuseu.id, terminalBoolean: true },
    ],
  });

  console.log('✅ Paragens associadas às vias');

  // Criar Proprietários
  const proprietario1 = await prisma.proprietario.create({
    data: {
      nome: 'António Manuel Silva',
      bi: '110203456789A',
      nacionalidade: 'Moçambicana',
      dataInicioOperacoes: new Date('2010-01-15'),
      endereco: 'Av. Julius Nyerere, Maputo',
      contacto1: 842345678,
      contacto2: 843456789,
    },
  });

  const proprietario2 = await prisma.proprietario.create({
    data: {
      nome: 'Maria Santos Costa',
      bi: '110204567890B',
      nacionalidade: 'Moçambicana',
      dataInicioOperacoes: new Date('2015-03-01'),
      endereco: 'Av. Eduardo Mondlane, Maputo',
      contacto1: 845678901,
    },
  });

  console.log('✅ Proprietários criados');

  // Criar Transportes com rotas individuais diferentes (EMTPM 2025)
  // Cada autocarro na mesma via tem um routePath diferente
  
  // Rota 1a: Baixa - Chamissava (2 autocarros, rotas diferentes)
  const transporte1 = await prisma.transporte.create({
    data: {
      matricula: 'AAA-1234-MP',
      modelo: 'Hiace',
      marca: 'Toyota',
      cor: 'Branco',
      lotacao: 15,
      codigo: 1001,
      codigoVia: 'VIA-1A',
      viaId: via1a.id,
      currGeoLocation: '-25.9734,32.5694',
      routePath: '32.5694,-25.9734;32.5594,-25.9861;32.5186,-26.0371', // Rota direta
    },
  });

  const transporte2 = await prisma.transporte.create({
    data: {
      matricula: 'BBB-5678-MP',
      modelo: 'Sprinter',
      marca: 'Mercedes-Benz',
      cor: 'Azul',
      lotacao: 18,
      codigo: 1002,
      codigoVia: 'VIA-1A',
      viaId: via1a.id,
      currGeoLocation: '-25.9861,32.5594',
      routePath: '32.5694,-25.9734;32.5518,-25.9328;32.5594,-25.9861;32.5186,-26.0371', // Via Junta
    },
  });

  // Rota 17: Baixa - Zimpeto via Costa do Sol (2 autocarros)
  const transporte3 = await prisma.transporte.create({
    data: {
      matricula: 'CCC-9012-MP',
      modelo: 'Quantum',
      marca: 'Volkswagen',
      cor: 'Prata',
      lotacao: 14,
      codigo: 1003,
      codigoVia: 'VIA-17',
      viaId: via17.id,
      currGeoLocation: '-25.9189,32.6347',
      routePath: '32.5694,-25.9734;32.6347,-25.9189;32.6184,-25.9525;32.6186,-25.8643', // Via Costa do Sol
    },
  });

  const transporte4 = await prisma.transporte.create({
    data: {
      matricula: 'DDD-3456-MP',
      modelo: 'Hiace',
      marca: 'Toyota',
      cor: 'Verde',
      lotacao: 15,
      codigo: 1004,
      codigoVia: 'VIA-17',
      viaId: via17.id,
      currGeoLocation: '-25.9525,32.6184',
      routePath: '32.5694,-25.9734;32.5836,-25.9723;32.6347,-25.9189;32.6186,-25.8643', // Via Museu e Costa do Sol
    },
  });

  // Rota 37: Museu - Zimpeto (2 autocarros)
  const transporte5 = await prisma.transporte.create({
    data: {
      matricula: 'EEE-7890-MP',
      modelo: 'Sprinter',
      marca: 'Mercedes-Benz',
      cor: 'Vermelho',
      lotacao: 18,
      codigo: 1005,
      codigoVia: 'VIA-37',
      viaId: via37.id,
      currGeoLocation: '-25.9723,32.5836',
      routePath: '32.5836,-25.9723;32.5714,-25.9688;32.6186,-25.8643', // Via Jardim
    },
  });

  const transporte6 = await prisma.transporte.create({
    data: {
      matricula: 'FFF-2468-MP',
      modelo: 'Quantum',
      marca: 'Volkswagen',
      cor: 'Amarelo',
      lotacao: 14,
      codigo: 1006,
      codigoVia: 'VIA-37',
      viaId: via37.id,
      currGeoLocation: '-25.9688,32.5714',
      routePath: '32.5836,-25.9723;32.5831,-25.9224;32.5714,-25.9688;32.6186,-25.8643', // Via Rádio Marcone
    },
  });

  // Rota 39a: Baixa - Zimpeto (3 autocarros, rotas diferentes)
  const transporte7 = await prisma.transporte.create({
    data: {
      matricula: 'GGG-1357-MP',
      modelo: 'Hiace',
      marca: 'Toyota',
      cor: 'Roxo',
      lotacao: 15,
      codigo: 1007,
      codigoVia: 'VIA-39A',
      viaId: via39a.id,
      currGeoLocation: '-25.9734,32.5694',
      routePath: '32.5694,-25.9734;32.5639,-25.9442;32.6382,-25.8373;32.6186,-25.8643', // Via Xipamanine
    },
  });

  const transporte8 = await prisma.transporte.create({
    data: {
      matricula: 'HHH-9753-MP',
      modelo: 'Sprinter',
      marca: 'Mercedes-Benz',
      cor: 'Laranja',
      lotacao: 18,
      codigo: 1008,
      codigoVia: 'VIA-39A',
      viaId: via39a.id,
      currGeoLocation: '-25.9442,32.5639',
      routePath: '32.5694,-25.9734;32.5714,-25.9688;32.6382,-25.8373;32.6186,-25.8643', // Via Jardim
    },
  });

  const transporte9 = await prisma.transporte.create({
    data: {
      matricula: 'III-8642-MP',
      modelo: 'Quantum',
      marca: 'Volkswagen',
      cor: 'Preto',
      lotacao: 14,
      codigo: 1009,
      codigoVia: 'VIA-39A',
      viaId: via39a.id,
      currGeoLocation: '-25.8373,32.6382',
      routePath: '32.5694,-25.9734;32.5939,-25.9083;32.6382,-25.8373;32.6186,-25.8643', // Via Hulene
    },
  });

  // Rota 47: Baixa - Tchumene (2 autocarros)
  const transporte10 = await prisma.transporte.create({
    data: {
      matricula: 'JJJ-4321-MP',
      modelo: 'Hiace',
      marca: 'Toyota',
      cor: 'Cinza',
      lotacao: 15,
      codigo: 1010,
      codigoVia: 'VIA-47',
      viaId: via47.id,
      currGeoLocation: '-25.9734,32.5694',
      routePath: '32.5694,-25.9734;32.5147,-25.9392;32.4042,-25.8856', // Via Portagem
    },
  });

  const transporte11 = await prisma.transporte.create({
    data: {
      matricula: 'KKK-8765-MP',
      modelo: 'Sprinter',
      marca: 'Mercedes-Benz',
      cor: 'Azul Claro',
      lotacao: 18,
      codigo: 1011,
      codigoVia: 'VIA-47',
      viaId: via47.id,
      currGeoLocation: '-25.9392,32.5147',
      routePath: '32.5694,-25.9734;32.4589,-25.9794;32.5147,-25.9392;32.4042,-25.8856', // Via Matola
    },
  });

  // Rota 51a: Baixa - Boane (2 autocarros)
  const transporte12 = await prisma.transporte.create({
    data: {
      matricula: 'LLL-1111-MP',
      modelo: 'Quantum',
      marca: 'Volkswagen',
      cor: 'Branco',
      lotacao: 14,
      codigo: 1012,
      codigoVia: 'VIA-51A',
      viaId: via51a.id,
      currGeoLocation: '-25.9734,32.5694',
      routePath: '32.5694,-25.9734;32.5147,-25.9392;32.3275,-26.0428', // Rota direta
    },
  });

  const transporte13 = await prisma.transporte.create({
    data: {
      matricula: 'MMM-2222-MP',
      modelo: 'Hiace',
      marca: 'Toyota',
      cor: 'Verde Escuro',
      lotacao: 15,
      codigo: 1013,
      codigoVia: 'VIA-51A',
      viaId: via51a.id,
      currGeoLocation: '-25.9392,32.5147',
      routePath: '32.5694,-25.9734;32.5147,-25.9392;32.2222,-26.0375;32.3275,-26.0428', // Via Mafuiane
    },
  });

  // Rota 53: Baixa - Albasine via Hulene (2 autocarros)
  const transporte14 = await prisma.transporte.create({
    data: {
      matricula: 'NNN-3333-MP',
      modelo: 'Sprinter',
      marca: 'Mercedes-Benz',
      cor: 'Vermelho Escuro',
      lotacao: 18,
      codigo: 1014,
      codigoVia: 'VIA-53',
      viaId: via53.id,
      currGeoLocation: '-25.9734,32.5694',
      routePath: '32.5694,-25.9734;32.5939,-25.9083;32.6382,-25.8373', // Via Hulene
    },
  });

  const transporte15 = await prisma.transporte.create({
    data: {
      matricula: 'OOO-4444-MP',
      modelo: 'Quantum',
      marca: 'Volkswagen',
      cor: 'Azul Marinho',
      lotacao: 14,
      codigo: 1015,
      codigoVia: 'VIA-53',
      viaId: via53.id,
      currGeoLocation: '-25.9083,32.5939',
      routePath: '32.5694,-25.9734;32.5831,-25.9224;32.5939,-25.9083;32.6382,-25.8373', // Via Rádio Marcone e Hulene
    },
  });

  // AUTOCARROS DA MATOLA (com rotas individuais diferentes)
  
  // Matola Sede - Museu (2 autocarros)
  const transporte16 = await prisma.transporte.create({
    data: {
      matricula: 'PPP-5555-MP',
      modelo: 'Hiace',
      marca: 'Toyota',
      cor: 'Branco',
      lotacao: 15,
      codigo: 1016,
      codigoVia: 'VIA-MAT-MUS',
      viaId: viaMatolaMuseu.id,
      currGeoLocation: '-25.9794,32.4589',
      routePath: '32.4589,-25.9794;32.4655,-25.9528;32.5147,-25.9392;32.5836,-25.9723', // Via Godinho
    },
  });

  const transporte17 = await prisma.transporte.create({
    data: {
      matricula: 'QQQ-6666-MP',
      modelo: 'Sprinter',
      marca: 'Mercedes-Benz',
      cor: 'Azul',
      lotacao: 18,
      codigo: 1017,
      codigoVia: 'VIA-MAT-MUS',
      viaId: viaMatolaMuseu.id,
      currGeoLocation: '-25.9528,32.4655',
      routePath: '32.4589,-25.9794;32.4695,-25.9067;32.5147,-25.9392;32.5836,-25.9723', // Via Liberdade
    },
  });

  // Matola Sede - Baixa (2 autocarros)
  const transporte18 = await prisma.transporte.create({
    data: {
      matricula: 'RRR-7777-MP',
      modelo: 'Quantum',
      marca: 'Volkswagen',
      cor: 'Verde',
      lotacao: 14,
      codigo: 1018,
      codigoVia: 'VIA-MAT-BAI',
      viaId: viaMatolaBaixa.id,
      currGeoLocation: '-25.9794,32.4589',
      routePath: '32.4589,-25.9794;32.4612,-25.9658;32.5147,-25.9392;32.5694,-25.9734', // Via Shoprite
    },
  });

  const transporte19 = await prisma.transporte.create({
    data: {
      matricula: 'SSS-8888-MP',
      modelo: 'Hiace',
      marca: 'Toyota',
      cor: 'Vermelho',
      lotacao: 15,
      codigo: 1019,
      codigoVia: 'VIA-MAT-BAI',
      viaId: viaMatolaBaixa.id,
      currGeoLocation: '-25.9658,32.4612',
      routePath: '32.4589,-25.9794;32.4638,-25.9415;32.5147,-25.9392;32.5694,-25.9734', // Via Santos
    },
  });

  // Tchumene - Baixa (2 autocarros)
  const transporte20 = await prisma.transporte.create({
    data: {
      matricula: 'TTT-9999-MP',
      modelo: 'Sprinter',
      marca: 'Mercedes-Benz',
      cor: 'Amarelo',
      lotacao: 18,
      codigo: 1020,
      codigoVia: 'VIA-TCH-BAI',
      viaId: viaTchumeneBaixa.id,
      currGeoLocation: '-25.8856,32.4042',
      routePath: '32.4042,-25.8856;32.4336,-25.8885;32.5147,-25.9392;32.5694,-25.9734', // Via Malhampsene
    },
  });

  const transporte21 = await prisma.transporte.create({
    data: {
      matricula: 'UUU-1010-MP',
      modelo: 'Quantum',
      marca: 'Volkswagen',
      cor: 'Preto',
      lotacao: 14,
      codigo: 1021,
      codigoVia: 'VIA-TCH-BAI',
      viaId: viaTchumeneBaixa.id,
      currGeoLocation: '-25.8885,32.4336',
      routePath: '32.4042,-25.8856;32.5050,-25.9320;32.5147,-25.9392;32.5694,-25.9734', // Via Bombas
    },
  });

  // Matola Gare - Baixa (2 autocarros)
  const transporte22 = await prisma.transporte.create({
    data: {
      matricula: 'VVV-2020-MP',
      modelo: 'Hiace',
      marca: 'Toyota',
      cor: 'Cinza',
      lotacao: 15,
      codigo: 1022,
      codigoVia: 'VIA-MGARE-BAI',
      viaId: viaMatolaGareBaixa.id,
      currGeoLocation: '-25.8271,32.4512',
      routePath: '32.4512,-25.8271;32.4336,-25.8885;32.5147,-25.9392;32.5694,-25.9734', // Via Malhampsene
    },
  });

  const transporte23 = await prisma.transporte.create({
    data: {
      matricula: 'WWW-3030-MP',
      modelo: 'Sprinter',
      marca: 'Mercedes-Benz',
      cor: 'Branco',
      lotacao: 18,
      codigo: 1023,
      codigoVia: 'VIA-MGARE-BAI',
      viaId: viaMatolaGareBaixa.id,
      currGeoLocation: '-25.8885,32.4336',
      routePath: '32.4512,-25.8271;32.4695,-25.9067;32.5147,-25.9392;32.5694,-25.9734', // Via Liberdade
    },
  });

  // Machava Sede - Museu (2 autocarros)
  const transporte24 = await prisma.transporte.create({
    data: {
      matricula: 'XXX-4040-MP',
      modelo: 'Quantum',
      marca: 'Volkswagen',
      cor: 'Azul Claro',
      lotacao: 14,
      codigo: 1024,
      codigoVia: 'VIA-MACH-MUS',
      viaId: viaMachavaMuseu.id,
      currGeoLocation: '-25.9125,32.4914',
      routePath: '32.4914,-25.9125;32.4792,-25.9255;32.5147,-25.9392;32.5836,-25.9723', // Via Machava Socimol
    },
  });

  const transporte25 = await prisma.transporte.create({
    data: {
      matricula: 'YYY-5050-MP',
      modelo: 'Hiace',
      marca: 'Toyota',
      cor: 'Verde Claro',
      lotacao: 15,
      codigo: 1025,
      codigoVia: 'VIA-MACH-MUS',
      viaId: viaMachavaMuseu.id,
      currGeoLocation: '-25.9255,32.4792',
      routePath: '32.4914,-25.9125;32.4589,-25.9794;32.5147,-25.9392;32.5836,-25.9723', // Via Matola Sede
    },
  });

  console.log('✅ Transportes criados');

  // Associar Proprietários aos Transportes
  await prisma.transporteProprietario.createMany({
    data: [
      { codigoTransporte: 1001, idProprietario: proprietario1.id, transporteId: transporte1.id, proprietarioId: proprietario1.id },
      { codigoTransporte: 1002, idProprietario: proprietario1.id, transporteId: transporte2.id, proprietarioId: proprietario1.id },
      { codigoTransporte: 1003, idProprietario: proprietario2.id, transporteId: transporte3.id, proprietarioId: proprietario2.id },
      { codigoTransporte: 1004, idProprietario: proprietario1.id, transporteId: transporte4.id, proprietarioId: proprietario1.id },
      { codigoTransporte: 1005, idProprietario: proprietario2.id, transporteId: transporte5.id, proprietarioId: proprietario2.id },
      { codigoTransporte: 1006, idProprietario: proprietario1.id, transporteId: transporte6.id, proprietarioId: proprietario1.id },
      { codigoTransporte: 1007, idProprietario: proprietario2.id, transporteId: transporte7.id, proprietarioId: proprietario2.id },
      { codigoTransporte: 1008, idProprietario: proprietario1.id, transporteId: transporte8.id, proprietarioId: proprietario1.id },
      { codigoTransporte: 1009, idProprietario: proprietario2.id, transporteId: transporte9.id, proprietarioId: proprietario2.id },
      { codigoTransporte: 1010, idProprietario: proprietario1.id, transporteId: transporte10.id, proprietarioId: proprietario1.id },
      { codigoTransporte: 1011, idProprietario: proprietario2.id, transporteId: transporte11.id, proprietarioId: proprietario2.id },
      { codigoTransporte: 1012, idProprietario: proprietario1.id, transporteId: transporte12.id, proprietarioId: proprietario1.id },
      { codigoTransporte: 1013, idProprietario: proprietario2.id, transporteId: transporte13.id, proprietarioId: proprietario2.id },
      { codigoTransporte: 1014, idProprietario: proprietario1.id, transporteId: transporte14.id, proprietarioId: proprietario1.id },
      { codigoTransporte: 1015, idProprietario: proprietario2.id, transporteId: transporte15.id, proprietarioId: proprietario2.id },
      // Matola buses
      { codigoTransporte: 1016, idProprietario: proprietario1.id, transporteId: transporte16.id, proprietarioId: proprietario1.id },
      { codigoTransporte: 1017, idProprietario: proprietario2.id, transporteId: transporte17.id, proprietarioId: proprietario2.id },
      { codigoTransporte: 1018, idProprietario: proprietario1.id, transporteId: transporte18.id, proprietarioId: proprietario1.id },
      { codigoTransporte: 1019, idProprietario: proprietario2.id, transporteId: transporte19.id, proprietarioId: proprietario2.id },
      { codigoTransporte: 1020, idProprietario: proprietario1.id, transporteId: transporte20.id, proprietarioId: proprietario1.id },
      { codigoTransporte: 1021, idProprietario: proprietario2.id, transporteId: transporte21.id, proprietarioId: proprietario2.id },
      { codigoTransporte: 1022, idProprietario: proprietario1.id, transporteId: transporte22.id, proprietarioId: proprietario1.id },
      { codigoTransporte: 1023, idProprietario: proprietario2.id, transporteId: transporte23.id, proprietarioId: proprietario2.id },
      { codigoTransporte: 1024, idProprietario: proprietario1.id, transporteId: transporte24.id, proprietarioId: proprietario1.id },
      { codigoTransporte: 1025, idProprietario: proprietario2.id, transporteId: transporte25.id, proprietarioId: proprietario2.id },
    ],
  });

  console.log('✅ Proprietários associados aos transportes');

  // Criar Motoristas
  const motoristaDocs = [
    {
      nome: 'João Manuel Silva',
      bi: '110203456789A',
      cartaConducao: 'CC-2023-001234',
      telefone: '+258 84 123 4567',
      email: 'joao.silva@email.com',
      dataNascimento: new Date('1985-03-15'),
      endereco: 'Av. Julius Nyerere, Maputo',
      status: 'ativo',
      transporteId: transporte1.id,
    },
    {
      nome: 'Maria Santos Costa',
      bi: '110204567890B',
      cartaConducao: 'CC-2023-002345',
      telefone: '+258 85 234 5678',
      email: 'maria.costa@email.com',
      dataNascimento: new Date('1990-07-22'),
      endereco: 'Av. Eduardo Mondlane, Maputo',
      status: 'ativo',
      transporteId: transporte2.id,
    },
    {
      nome: 'Carlos Alberto Nhaca',
      bi: '110205678901C',
      cartaConducao: 'CC-2023-003456',
      telefone: '+258 86 345 6789',
      email: 'carlos.nhaca@email.com',
      dataNascimento: new Date('1988-11-30'),
      endereco: 'Av. Mao Tse Tung, Maputo',
      status: 'ativo',
      transporteId: transporte3.id,
    },
    {
      nome: 'Pedro Macamo',
      bi: '110206789012D',
      cartaConducao: 'CC-2023-004567',
      telefone: '+258 87 456 7890',
      email: 'pedro.macamo@email.com',
      dataNascimento: new Date('1992-05-18'),
      endereco: 'Matola, Mozambique',
      status: 'ativo',
      transporteId: transporte4.id,
    },
    {
      nome: 'Ana Sitoe',
      bi: '110207890123E',
      cartaConducao: 'CC-2023-005678',
      telefone: '+258 84 567 8901',
      email: 'ana.sitoe@email.com',
      dataNascimento: new Date('1987-09-25'),
      endereco: 'Costa do Sol, Maputo',
      status: 'ativo',
      transporteId: transporte5.id,
    },
  ] as const;

  await prisma.motorista.createMany({
    data: motoristaDocs.map((m) => ({
      ...m,
      numeroEmergencia: '+258820000000',
      contatoEmergencia: 'Familiar',
      dataEmissaoBI: new Date('2015-01-10'),
      dataValidadeBI: new Date('2030-01-10'),
      dataEmissaoCarta: new Date('2018-06-01'),
      dataValidadeCarta: new Date('2028-06-01'),
    })),
  });

  console.log('✅ Motoristas criados');

  // Criar Utentes
  const utente1 = await prisma.utente.create({
    data: {
      nome: 'João Pedro Silva',
      email: 'joao.silva@email.com',
      telefone: '+258840000001',
      senha: '$2a$10$rZ5qH8vK9xJ3yL2wN4pO5.xQ7tR8sU9vW0xY1zA2bC3dE4fG5hI6j', // senha: 123456
      mISSION: 'USER-001',
      geoLocation: '-25.9732,32.5632',
      subscrito: true,
      dataSubscricao: new Date(),
    },
  });

  const utente2 = await prisma.utente.create({
    data: {
      nome: 'Maria Santos Costa',
      email: 'maria.costa@email.com',
      telefone: '+258850000002',
      senha: '$2a$10$rZ5qH8vK9xJ3yL2wN4pO5.xQ7tR8sU9vW0xY1zA2bC3dE4fG5hI6j', // senha: 123456
      mISSION: 'USER-002',
      geoLocation: '-25.9692,32.5732',
      subscrito: true,
      dataSubscricao: new Date(),
    },
  });

  const utente3 = await prisma.utente.create({
    data: {
      nome: 'Carlos Nhaca',
      email: 'carlos.nhaca@email.com',
      telefone: '+258860000003',
      senha: '$2a$10$rZ5qH8vK9xJ3yL2wN4pO5.xQ7tR8sU9vW0xY1zA2bC3dE4fG5hI6j', // senha: 123456
      mISSION: 'USER-003',
      geoLocation: '-25.9794,32.4589',
      subscrito: true,
      dataSubscricao: new Date(),
    },
  });

  console.log('✅ Utentes criados');

  // Criar Missões (pedidos de rastreamento de autocarros)
  await prisma.mISSION.createMany({
    data: [
      {
        mISSIONUtente: 'USER-001',
        codigoParagem: 'PAR-BAIXA',
        geoLocationUtente: '-25.9732,32.5632',
        geoLocationParagem: '-25.9734,32.5694',
        utenteId: utente1.id,
        paragemId: paragemBaixa.id,
      },
      {
        mISSIONUtente: 'USER-001',
        codigoParagem: 'PAR-MUSEU',
        geoLocationUtente: '-25.9732,32.5632',
        geoLocationParagem: '-25.9723,32.5836',
        utenteId: utente1.id,
        paragemId: paragemMuseu.id,
      },
      {
        mISSIONUtente: 'USER-002',
        codigoParagem: 'PAR-ZIMPETO',
        geoLocationUtente: '-25.9692,32.5732',
        geoLocationParagem: '-25.8643,32.6186',
        utenteId: utente2.id,
        paragemId: paragemZimpeto.id,
      },
      {
        mISSIONUtente: 'USER-002',
        codigoParagem: 'PAR-COSTASOL',
        geoLocationUtente: '-25.9692,32.5732',
        geoLocationParagem: '-25.9189,32.6347',
        utenteId: utente2.id,
        paragemId: paragemCostaSol.id,
      },
      {
        mISSIONUtente: 'USER-003',
        codigoParagem: 'PAR-MATSEDE',
        geoLocationUtente: '-25.9794,32.4589',
        geoLocationParagem: '-25.9794,32.4589',
        utenteId: utente3.id,
        paragemId: paragemMatolaSede.id,
      },
      {
        mISSIONUtente: 'USER-003',
        codigoParagem: 'PAR-PORTAG',
        geoLocationUtente: '-25.9794,32.4589',
        geoLocationParagem: '-25.9392,32.5147',
        utenteId: utente3.id,
        paragemId: paragemPortagem.id,
      },
    ],
  });

  console.log('✅ Missões criadas (pedidos de rastreamento)');

  // Criar Histórico de Localização para TODOS os 25 transportes
  const allTransportes = [
    transporte1, transporte2, transporte3, transporte4, transporte5,
    transporte6, transporte7, transporte8, transporte9, transporte10,
    transporte11, transporte12, transporte13, transporte14, transporte15,
    transporte16, transporte17, transporte18, transporte19, transporte20,
    transporte21, transporte22, transporte23, transporte24, transporte25,
  ];

  const geoLocationsData = allTransportes.map((transporte, index) => {
    // Usar a localização atual do transporte
    const [lat, lng] = transporte.currGeoLocation!.split(',').map(Number);
    
    // Criar histórico de 3 posições anteriores (simulando movimento)
    const hist1Lat = lat + (Math.random() - 0.5) * 0.01;
    const hist1Lng = lng + (Math.random() - 0.5) * 0.01;
    const hist2Lat = lat + (Math.random() - 0.5) * 0.02;
    const hist2Lng = lng + (Math.random() - 0.5) * 0.02;
    const hist3Lat = lat + (Math.random() - 0.5) * 0.03;
    const hist3Lng = lng + (Math.random() - 0.5) * 0.03;

    return {
      geoLocationTransporte: transporte.currGeoLocation!,
      geoDirection: 'Em circulação',
      codigoTransporte: transporte.codigo,
      transporteId: transporte.id,
      geoLocationHist1: `${hist1Lat},${hist1Lng}`,
      geoLocationHist2: `${hist2Lat},${hist2Lng}`,
      geoLocationHist3: `${hist3Lat},${hist3Lng}`,
      geoDateTime1: new Date(Date.now() - (15 + index) * 60000),
      geoDateTime2: new Date(Date.now() - (10 + index) * 60000),
      geoDateTime3: new Date(Date.now() - (5 + index) * 60000),
    };
  });

  await prisma.geoLocation.createMany({
    data: geoLocationsData,
  });

  console.log('✅ Histórico de localização criado para todos os 25 transportes');

  console.log('');
  console.log('🎉 Seed concluído com sucesso!');
  console.log('');
  console.log('📊 Resumo:');
  console.log(`   - 1 Administrador`);
  console.log(`   - 2 Províncias`);
  console.log(`   - 2 Cidades`);
  console.log(`   - 2 Municípios`);
  console.log(`   - 18 Vias (Rotas EMTPM 2025 + Matola)`);
  console.log(`   - 32 Paragens`);
  console.log(`   - 2 Proprietários`);
  console.log(`   - 25 Transportes`);
  console.log(`   - 5 Motoristas`);
  console.log(`   - 3 Utentes`);
  console.log(`   - 6 Missões (pedidos de rastreamento)`);
  console.log(`   - 25 GeoLocations (histórico de posição para cada transporte)`);
  console.log('');
  console.log('📍 Rotas EMTPM 2025 - Maputo:');
  console.log(`   - Rota 1a: Baixa → Chamissava (via Katembe)`);
  console.log(`   - Rota 11: Baixa → Michafutene (via Jardim)`);
  console.log(`   - Rota 17: Baixa → Zimpeto (via Costa do Sol)`);
  console.log(`   - Rota 20: Baixa → Matendene (via Jardim)`);
  console.log(`   - Rota 21: Museu → Albasine (via Dom Alexandre)`);
  console.log(`   - Rota 37: Museu → Zimpeto (via Jardim)`);
  console.log(`   - Rota 39a: Baixa → Zimpeto (via Jardim)`);
  console.log(`   - Rota 39b: Baixa → Boquisso (via Jardim)`);
  console.log(`   - Rota 47: Baixa → Tchumene (via Portagem)`);
  console.log(`   - Rota 51a: Baixa → Boane (via Portagem)`);
  console.log(`   - Rota 51c: Baixa → Mafuiane (via Portagem)`);
  console.log(`   - Rota 53: Baixa → Albasine (via Hulene)`);
  console.log('');
  console.log('📍 Rotas da Matola:');
  console.log(`   - Matola Sede → Museu (via N4)`);
  console.log(`   - Matola Sede → Baixa (via N4/Portagem)`);
  console.log(`   - Tchumene → Baixa (via N4)`);
  console.log(`   - Malhampsene → Museu (via N4)`);
  console.log(`   - Matola Gare → Baixa`);
  console.log(`   - Machava Sede → Museu`);
  console.log('');
  console.log('🚌 Cada autocarro tem sua própria rota individual!');
  console.log('   Autocarros na mesma via seguem caminhos diferentes.');
  console.log('');
}

// Export main for use in API route
export { main };

main()
  .catch((e) => {
    console.error('❌ Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
