import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const motoristata = await prisma.motorista.findUnique({
      where: { id },
      include: {
        transporte: true
      }
    });

    if (!motoristata) {
      const response = NextResponse.json({ error: 'Motorista não encontrado' }, { status: 404 });
      response.headers.set('Access-Control-Allow-Origin', '*');
      return response;
    }

    const response = NextResponse.json(motoristata);
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (error) {
    console.error('Error fetching motoristata:', error);
    const response = NextResponse.json({ error: 'Erro ao buscar motorista' }, { status: 500 });
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } finally {
    await prisma.$disconnect();
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Check if motoristata exists
    const existing = await prisma.motorista.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Motorista não encontrado' }, { status: 404 });
    }

    // Build update data - only include password if it's not empty
    const updateData: any = {
      nome,
      bi,
      cartaConducao: cartaConducao || '',
      telefone,
      email: email || '',
      dataNascimento: dataNascimento ? new Date(dataNascimento) : existing.dataNascimento,
      endereco: endereco || '',
      foto: foto || null,
      nacionalidade: nacionalidade || 'Moçambicana',
      genero: genero || 'Masculino',
      estadoCivil: estadoCivil || 'Solteiro',
      numeroEmergencia: numeroEmergencia || '',
      contatoEmergencia: contatoEmergencia || '',
      deficiencia: deficiencia || null,
      dataEmissaoBI: dataEmissaoBI ? new Date(dataEmissaoBI) : existing.dataEmissaoBI,
      dataValidadeBI: dataValidadeBI ? new Date(dataValidadeBI) : existing.dataValidadeBI,
      dataEmissaoCarta: dataEmissaoCarta ? new Date(dataEmissaoCarta) : existing.dataEmissaoCarta,
      dataValidadeCarta: dataValidadeCarta ? new Date(dataValidadeCarta) : existing.dataValidadeCarta,
      categoriaCarta: categoriaCarta || 'D',
      experienciaAnos: experienciaAnos || 0,
      observacoes: observacoes || null,
      status: status || 'ativo',
      transporteId: transporteId || null
    };

    // Only update password if provided and not empty
    if (password && password.trim() !== '') {
      updateData.password = password;
    }

    const updatedMotorista = await prisma.motorista.update({
      where: { id },
      data: updateData
    });

    const response = NextResponse.json(updatedMotorista);
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } catch (error: any) {
    console.error('Error updating motoristata:', error);
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Já existe um motorista com este BI ou email' },
        { status: 400 }
      );
    }
    const response = NextResponse.json({ error: 'Erro ao atualizar motorista' }, { status: 500 });
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  } finally {
    await prisma.$disconnect();
  }
}