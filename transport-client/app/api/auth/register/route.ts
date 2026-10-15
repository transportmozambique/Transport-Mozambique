import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { nome, email, telefone, senha } = await request.json();

    // Validar campos obrigatórios
    if (!nome || !email || !telefone || !senha) {
      return NextResponse.json(
        { error: 'Nome, email, telefone e senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Validar senha (mínimo 6 caracteres)
    if (senha.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve ter no mínimo 6 caracteres' },
        { status: 400 }
      );
    }

    // Verificar se o telefone já existe
    const existingUtente = await prisma.utente.findUnique({
      where: { telefone },
    });

    if (existingUtente) {
      return NextResponse.json(
        { error: 'Este número de telefone já está registado' },
        { status: 400 }
      );
    }

    // Verificar se o email já existe
    const existingEmail = await prisma.utente.findUnique({
      where: { email },
    });

    if (existingEmail) {
      return NextResponse.json(
        { error: 'Este email já está registado' },
        { status: 400 }
      );
    }

    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);

    // Criar novo utente
    const utente = await prisma.utente.create({
      data: {
        nome,
        email,
        telefone,
        senha: senhaHash,
        mISSION: `USER-${Date.now()}`,
        subscrito: true,
        dataSubscricao: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      utente: {
        id: utente.id,
        nome: utente.nome,
        email: utente.email,
        telefone: utente.telefone,
      },
    });
  } catch (error) {
    console.error('Erro ao registar utente:', error);
    return NextResponse.json(
      { error: 'Erro ao registar utente' },
      { status: 500 }
    );
  }
}
