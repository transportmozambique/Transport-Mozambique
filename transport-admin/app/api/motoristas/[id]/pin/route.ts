import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

/**
 * PIN do motorista para o portal do motorista e o menu USSD do motorista (*6). O administrador
 * gera-o; é mostrado uma vez e só o seu hash bcrypt fica guardado. Um PIN novo substitui o antigo.
 * Porquê gerado e não escolhido: PINs escolhidos repetem-se (datas, 123456) e são fáceis de adivinhar.
 */

// GET: se o motorista tem PIN
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await prisma.motorista.findUnique({ where: { id }, select: { password: true } });
  if (!m) return NextResponse.json({ error: 'Motorista não encontrado' }, { status: 404 });
  return NextResponse.json({ definido: Boolean(m.password && /^\$2[aby]\$/.test(m.password)) });
}

// POST: gera um PIN novo de 6 algarismos
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exists = await prisma.motorista.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: 'Motorista não encontrado' }, { status: 404 });

  const pin = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await prisma.motorista.update({ where: { id }, data: { password: await bcrypt.hash(pin, 10) } });
  return NextResponse.json({ pin });
}

// DELETE: remove o PIN (o motorista deixa de poder entrar)
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.motorista.update({ where: { id }, data: { password: null } });
  return NextResponse.json({ definido: false });
}
