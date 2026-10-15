import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const search = searchParams.get('search') || '';

    const skip = (page - 1) * limit;

    // Build where clause for search
    const where = search
      ? {
          OR: [
            { nome: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    // Get total count
    const total = await prisma.administrador.count({ where });

    // Get paginated data
    const administradores = await prisma.administrador.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        nome: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json(
      {
        data: administradores,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching administradores:', error);
    return NextResponse.json(
      { error: 'Erro ao carregar administradores', details: error.message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nome, email, senha } = body;

    // Validate required fields
    if (!nome || !email || !senha) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: nome, email, senha' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existing = await prisma.administrador.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Email já existe' },
        { status: 400 }
      );
    }

    // Hash password
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(senha, 10);

    // Create administrador
    const administrador = await prisma.administrador.create({
      data: {
        nome,
        email,
        senha: hashedPassword,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        createdAt: true,
      },
    });

    return NextResponse.json(administrador, { status: 201 });
  } catch (error: any) {
    console.error('Error creating administrador:', error);
    return NextResponse.json(
      { error: 'Erro ao criar administrador', details: error.message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
