import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

/**
 * Driver PIN for the driver portal and the USSD driver menu (*6). The admin generates it; it is
 * shown once and only its bcrypt hash is stored. A new PIN replaces the old one.
 */

// GET: whether the driver has a PIN
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await prisma.motorista.findUnique({ where: { id }, select: { password: true } });
  if (!m) return NextResponse.json({ error: 'Motorista não encontrado' }, { status: 404 });
  return NextResponse.json({ definido: Boolean(m.password && /^\$2[aby]\$/.test(m.password)) });
}

// POST: generates a new 6-digit PIN
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exists = await prisma.motorista.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: 'Motorista não encontrado' }, { status: 404 });

  const pin = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await prisma.motorista.update({ where: { id }, data: { password: await bcrypt.hash(pin, 10) } });
  return NextResponse.json({ pin });
}

// DELETE: removes the PIN (the driver can no longer sign in)
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.motorista.update({ where: { id }, data: { password: null } });
  return NextResponse.json({ definido: false });
}
