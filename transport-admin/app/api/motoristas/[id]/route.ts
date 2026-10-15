import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('🔍 Buscando motorista com ID:', id);
    
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
      return NextResponse.json(
        { error: 'Motorista não encontrado' },
        { status: 404 }
      );
    }

    console.log('✅ Motorista encontrado:', motorista.nome);
    return NextResponse.json(motorista);
  } catch (error: any) {
    console.error('❌ ERRO DETALHADO ao buscar motorista:');
    console.error('Mensagem:', error.message);
    console.error('Stack:', error.stack);
    console.error('Erro completo:', error);
    
    return NextResponse.json(
      { 
        error: 'Erro ao buscar motorista',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validação de campos obrigatórios
    if (!body.nome || !body.bi || !body.cartaConducao || !body.telefone || 
        !body.email || !body.dataNascimento || !body.endereco || 
        !body.numeroEmergencia || !body.contatoEmergencia ||
        !body.dataEmissaoBI || !body.dataValidadeBI ||
        !body.dataEmissaoCarta || !body.dataValidadeCarta) {
      return NextResponse.json(
        { error: 'Campos obrigatórios em falta' },
        { status: 400 }
      );
    }

    // Check if motorista exists
    const existingMotorista = await prisma.motorista.findUnique({
      where: { id },
    });

    if (!existingMotorista) {
      return NextResponse.json(
        { error: 'Motorista não encontrado' },
        { status: 404 }
      );
    }

    // Check if BI is already used by another motorista
    if (body.bi !== existingMotorista.bi) {
      const biExists = await prisma.motorista.findUnique({
        where: { bi: body.bi },
      });

      if (biExists) {
        return NextResponse.json(
          { error: 'Já existe um motorista com este BI' },
          { status: 400 }
        );
      }
    }

    // Check if carta de condução is already used by another motorista
    if (body.cartaConducao !== existingMotorista.cartaConducao) {
      const cartaExists = await prisma.motorista.findUnique({
        where: { cartaConducao: body.cartaConducao },
      });

      if (cartaExists) {
        return NextResponse.json(
          { error: 'Já existe um motorista com este número de carta de condução' },
          { status: 400 }
        );
      }
    }

    // Check if email is already used by another motorista
    if (body.email !== existingMotorista.email) {
      const emailExists = await prisma.motorista.findUnique({
        where: { email: body.email },
      });

      if (emailExists) {
        return NextResponse.json(
          { error: 'Já existe um motorista com este email' },
          { status: 400 }
        );
      }
    }

    // Check if transporte is already assigned to another motorista
    if (body.transporteId && body.transporteId !== existingMotorista.transporteId) {
      const transporteExists = await prisma.motorista.findFirst({
        where: { 
          transporteId: body.transporteId,
          id: { not: id }
        },
      });

      if (transporteExists) {
        return NextResponse.json(
          { error: 'Este transporte já está atribuído a outro motorista' },
          { status: 400 }
        );
      }
    }

    const motorista = await prisma.motorista.update({
      where: { id },
      data: {
        nome: body.nome,
        bi: body.bi,
        cartaConducao: body.cartaConducao,
        telefone: body.telefone,
        email: body.email,
        dataNascimento: new Date(body.dataNascimento),
        endereco: body.endereco,
        foto: body.foto || null,
        nacionalidade: body.nacionalidade || 'Moçambicana',
        genero: body.genero || 'Masculino',
        estadoCivil: body.estadoCivil || 'Solteiro',
        numeroEmergencia: body.numeroEmergencia,
        contatoEmergencia: body.contatoEmergencia,
        deficiencia: body.deficiencia || null,
        dataEmissaoBI: new Date(body.dataEmissaoBI),
        dataValidadeBI: new Date(body.dataValidadeBI),
        dataEmissaoCarta: new Date(body.dataEmissaoCarta),
        dataValidadeCarta: new Date(body.dataValidadeCarta),
        categoriaCarta: body.categoriaCarta || 'D',
        experienciaAnos: body.experienciaAnos || 0,
        observacoes: body.observacoes || null,
        status: body.status || 'ativo',
        transporteId: body.transporteId !== undefined ? body.transporteId : undefined,
      },
      include: {
        transporte: {
          select: {
            id: true,
            matricula: true,
            modelo: true,
            marca: true,
          },
        },
      },
    });

    return NextResponse.json(motorista);
  } catch (error: any) {
    console.error('Erro ao atualizar motorista:', error);
    
    // Handle Prisma unique constraint errors
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'campo';
      return NextResponse.json(
        { error: `Já existe um motorista com este ${field}` },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Erro ao atualizar motorista', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';
    
    // Check if motorista exists and has transporte assigned
    const motorista = await prisma.motorista.findUnique({
      where: { id },
      include: {
        transporte: {
          select: {
            id: true,
            matricula: true,
          },
        },
      },
    });

    if (!motorista) {
      return NextResponse.json(
        { error: 'Motorista não encontrado' },
        { status: 404 }
      );
    }

    if (motorista.transporte && !force) {
      return NextResponse.json(
        { 
          error: `Este motorista está atribuído ao transporte ${motorista.transporte.matricula}.`,
          details: `Este motorista está atribuído ao transporte ${motorista.transporte.matricula}.`
        },
        { status: 400 }
      );
    }

    // If force=true, remove transporte association first
    if (force && motorista.transporteId) {
      await prisma.motorista.update({
        where: { id },
        data: { transporteId: null as any },
      });
    }

    await prisma.motorista.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao eliminar motorista:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao eliminar motorista',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
