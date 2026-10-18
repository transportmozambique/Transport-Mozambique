import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { utenteIdFromRequest, unauthorized } from '@/lib/userSession';

export async function GET(request: NextRequest) {
  try {
    // Os alertas do próprio passageiro; um utenteId na query tem de ser o dele
    const utenteId = utenteIdFromRequest(request);
    const asked = request.nextUrl.searchParams.get('utenteId');
    if (!utenteId || (asked && asked !== utenteId)) return unauthorized();

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
