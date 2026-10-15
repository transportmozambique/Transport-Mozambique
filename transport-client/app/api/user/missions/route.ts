import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const utenteId = searchParams.get('utenteId');

    if (!utenteId) {
      return NextResponse.json(
        { error: "utenteId é obrigatório" },
        { status: 400 }
      );
    }

    const missions = await prisma.mISSION.findMany({
      where: { utenteId },
      include: {
        paragem: {
          select: {
            nome: true,
            codigo: true,
            geoLocation: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ missions });
  } catch (error) {
    console.error("Erro ao buscar missões:", error);
    return NextResponse.json(
      { error: "Erro ao buscar missões" },
      { status: 500 }
    );
  }
}
