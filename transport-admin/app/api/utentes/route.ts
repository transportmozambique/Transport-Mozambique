import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { idsByPhoneDigits } from '@/lib/phoneSearch';
import bcrypt from 'bcryptjs';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const search = searchParams.get('search') || '';

    const skip = (page - 1) * limit;

    // Condição da pesquisa; um número de telefone também encontra telefones guardados com espaços
    const phoneIds = search ? await idsByPhoneDigits('Utente', search) : [];
    const where = search
      ? {
          OR: [
            { nome: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { telefone: { contains: search, mode: 'insensitive' as const } },
            { mISSION: { contains: search, mode: 'insensitive' as const } },
            ...(phoneIds.length ? [{ id: { in: phoneIds } }] : []),
          ],
        }
      : {};

    // Total de linhas
    const total = await prisma.utente.count({ where });

    // A página pedida
    const utentes = await prisma.utente.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        _count: {
          select: {
            missoes: true,
          },
        },
      },
    });

    // Tirar a palavra-passe da resposta
    const sanitizedUtentes = utentes.map(({ senha, ...utente }) => utente);

    return NextResponse.json({
      data: sanitizedUtentes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Erro ao buscar utentes:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar utentes' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nome, email, telefone, senha, mISSION, subscrito, dataSubscricao, geoLocation } = body;

    // Confirmar os campos obrigatórios
    if (!nome || !email || !telefone || !senha || !mISSION) {
      return NextResponse.json(
        { error: 'Campos obrigatórios em falta' },
        { status: 400 }
      );
    }

    // O email já existe?
    const emailExists = await prisma.utente.findUnique({
      where: { email },
    });

    if (emailExists) {
      return NextResponse.json(
        { error: 'Email já está em uso' },
        { status: 400 }
      );
    }

    // O telefone já existe?
    const telefoneExists = await prisma.utente.findUnique({
      where: { telefone },
    });

    if (telefoneExists) {
      return NextResponse.json(
        { error: 'Telefone já está em uso' },
        { status: 400 }
      );
    }

    // O MISSION já existe?
    const missionExists = await prisma.utente.findUnique({
      where: { mISSION },
    });

    if (missionExists) {
      return NextResponse.json(
        { error: 'MISSION já está em uso' },
        { status: 400 }
      );
    }

    // Criar o utente com a palavra-passe em hash
    const hashedPassword = await bcrypt.hash(senha, 10);
    
    const utente = await prisma.utente.create({
      data: {
        nome,
        email,
        telefone,
        senha: hashedPassword,
        mISSION,
        subscrito: subscrito || false,
        dataSubscricao: subscrito && dataSubscricao ? new Date(dataSubscricao) : null,
        geoLocation: geoLocation || null,
      },
      include: {
        _count: {
          select: {
            missoes: true,
          },
        },
      },
    });

    // Tirar a palavra-passe da resposta
    const { senha: _, ...sanitizedUtente } = utente;

    return NextResponse.json(sanitizedUtente, { status: 201 });
  } catch (error: any) {
    console.error('Erro ao criar utente:', error);
    
    // Erros de valor único do Prisma
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'campo';
      return NextResponse.json(
        { error: `Já existe um utente com este ${field}` },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Erro ao criar utente' },
      { status: 500 }
    );
  }
}
