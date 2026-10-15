import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

/**
 * Admin Authentication API
 * POST /api/auth/admin - Login with email/password
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, username } = body;

    // Option 1: Hardcoded admin (for demo/fallback)
    if (username === 'admin' && password === 'admin123') {
      return NextResponse.json({
        success: true,
        admin: {
          id: 'demo-admin',
          nome: 'Administrador Demo',
          email: 'admin@demo.com',
          role: 'admin',
        },
      });
    }

    // Option 2: Database authentication
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email e senha são obrigatórios' },
        { status: 400 }
      );
    }

    // Find admin in database
    const admin = await prisma.administrador.findUnique({
      where: { email },
      select: {
        id: true,
        nome: true,
        email: true,
        senha: true,
      },
    });

    if (!admin) {
      return NextResponse.json(
        { success: false, error: 'Credenciais inválidas' },
        { status: 401 }
      );
    }

    // Check if password is hashed or plain text
    let isPasswordValid = false;
    
    if (admin.senha.startsWith('$2a$') || admin.senha.startsWith('$2b$')) {
      // Password is hashed with bcrypt
      isPasswordValid = await bcrypt.compare(password, admin.senha);
    } else {
      // Password is plain text (for development)
      isPasswordValid = password === admin.senha;
    }

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: 'Credenciais inválidas' },
        { status: 401 }
      );
    }

    // Return admin data (without password)
    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        nome: admin.nome,
        email: admin.email,
        role: 'admin',
      },
    });

  } catch (error) {
    console.error('❌ Admin login error:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao fazer login' },
      { status: 500 }
    );
  }
}
