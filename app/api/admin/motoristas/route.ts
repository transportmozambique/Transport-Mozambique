import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const motoristas = await prisma.motorista.findMany({
      select: {
        id: true,
        nome: true,
        bi: true,
        cartaConducao: true,
        telefone: true,
        email: true,
        dataNascimento: true,
        endereco: true,
        foto: true,
        nacionalidade: true,
        genero: true,
        categoriaCarta: true,
        experienciaAnos: true,
        status: true,
        createdAt: true
      },
      orderBy: { nome: 'asc' }
    });

    const response = NextResponse.json(motoristas);
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (error) {
    console.error('Error fetching motoristas:', error);
    const response = NextResponse.json([]);
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      nome,
      bi,
      cartaConducao,
      telefone,
      email,
      dataNascimento,
      endereco,
      foto,
      nacionalidade,
      genero,
      estadoCivil,
      numeroEmergencia,
      contatoEmergencia,
      deficiencia,
      dataEmissaoBI,
      dataValidadeBI,
      dataEmissaoCarta,
      dataValidadeCarta,
      categoriaCarta,
      experienciaAnos,
      password,
      observacoes,
      status,
      transporteId
    } = body;

    if (!nome || !bi || !telefone) {
      return NextResponse.json(
        { error: 'Nome, BI e telefone são obrigatórios' },
        { status: 400 }
      );
    }

    const novoMotorista = await prisma.motorista.create({
      data: {
        nome,
        bi,
        cartaConducao: cartaConducao || '',
        telefone,
        email: email || '',
        dataNascimento: dataNascimento ? new Date(dataNascimento) : new Date(),
        endereco: endereco || '',
        foto: foto || null,
        nacionalidade: nacionalidade || 'Moçambicana',
        genero: genero || 'Masculino',
        estadoCivil: estadoCivil || 'Solteiro',
        numeroEmergencia: numeroEmergencia || '',
        contatoEmergencia: contatoEmergencia || '',
        deficiencia: deficiencia || null,
        dataEmissaoBI: dataEmissaoBI ? new Date(dataEmissaoBI) : new Date(),
        dataValidadeBI: dataValidadeBI ? new Date(dataValidadeBI) : new Date(),
        dataEmissaoCarta: dataEmissaoCarta ? new Date(dataEmissaoCarta) : new Date(),
        dataValidadeCarta: dataValidadeCarta ? new Date(dataValidadeCarta) : new Date(),
        categoriaCarta: categoriaCarta || 'D',
        experienciaAnos: experienciaAnos || 0,
        password: password || null,
        observacoes: observacoes || null,
        status: status || 'ativo',
        transporteId: transporteId || null
      }
    });

    const response = NextResponse.json(novoMotorista);
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (error: any) {
    console.error('Error creating motoristata:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Já existe um motorista com este BI ou email' },
        { status: 400 }
      );
    }
    const response = NextResponse.json({ error: 'Erro ao criar motoristata' }, { status: 500 });
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } finally {
    await prisma.$disconnect();
  }
}