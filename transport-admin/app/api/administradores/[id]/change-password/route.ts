import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Senha atual e nova senha são obrigatórias" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "A nova senha deve ter pelo menos 6 caracteres" },
        { status: 400 }
      );
    }

    // Ler o administrador com a palavra-passe
    const admin = await prisma.administrador.findUnique({
      where: { id },
      select: {
        id: true,
        senha: true,
      },
    });

    if (!admin) {
      return NextResponse.json(
        { error: "Administrador não encontrado" },
        { status: 404 }
      );
    }

    // Confirmar a palavra-passe actual
    const isPasswordValid = await bcrypt.compare(currentPassword, admin.senha);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Senha atual incorreta" },
        { status: 401 }
      );
    }

    // Hash da nova palavra-passe (bcrypt: nunca se guarda em claro)
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Guardar a palavra-passe
    await prisma.administrador.update({
      where: { id },
      data: { senha: hashedPassword },
    });

    return NextResponse.json({ 
      success: true, 
      message: "Senha alterada com sucesso" 
    });
  } catch (error) {
    console.error("Erro ao alterar senha:", error);
    return NextResponse.json(
      { error: "Erro ao alterar senha" },
      { status: 500 }
    );
  }
}
