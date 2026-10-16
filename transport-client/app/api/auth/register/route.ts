import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { createUserToken } from '@/lib/userSession';

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

    // Verificar se o telefone já existe. Números vindos do USSD estão gravados com +258;
    // o formulário pode não ter o prefixo.
    const digits = String(telefone).replace(/\s+/g, '');
    const local = digits.replace(/^\+?258/, '');
    const existingUtente = await prisma.utente.findFirst({
      where: { telefone: { in: [digits, local, `+258${local}`, `258${local}`] } },
    });
    // Quem só usou o USSD tem uma conta sem senha: o registo completa essa conta
    const contaUssd = existingUtente && !/^\$2[aby]\$/.test(existingUtente.senha);

    if (existingUtente && !contaUssd) {
      return NextResponse.json(
        { error: 'Este número de telefone já está registado' },
        { status: 400 }
      );
    }

    // Verificar se o email já existe
    const existingEmail = await prisma.utente.findUnique({
      where: { email },
    });

    if (existingEmail && existingEmail.id !== existingUtente?.id) {
      return NextResponse.json(
        { error: 'Este email já está registado' },
        { status: 400 }
      );
    }

    // Hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);

    // Criar novo utente (ou completar a conta criada pelo USSD, mantendo os alertas)
    const dados = {
      nome,
      email,
      senha: senhaHash,
      subscrito: true,
      dataSubscricao: new Date(),
    };
    const utente = contaUssd && existingUtente
      ? await prisma.utente.update({ where: { id: existingUtente.id }, data: dados })
      : await prisma.utente.create({ data: { ...dados, telefone, mISSION: `USER-${Date.now()}` } });

    const token = createUserToken(utente.id);
    if (!token) {
      console.error('USER_SESSION_SECRET is not set');
      return NextResponse.json({ error: 'Sessão indisponível. Tente mais tarde.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      utente: {
        id: utente.id,
        nome: utente.nome,
        email: utente.email,
        telefone: utente.telefone,
        token,
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
