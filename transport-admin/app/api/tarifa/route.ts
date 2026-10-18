import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * A regra de tarifa activa (Tarifa): a base de todas as tarifas, tempos de viagem e posições pelo
 * horário, na web, no USSD e aqui. A aplicação dos passageiros volta a lê-la até 60 s depois de uma
 * alteração. Porquê na base de dados: um preço muda-se nesta página, sem publicar código novo.
 *
 * GET  /api/tarifa → a regra activa
 * PUT  /api/tarifa {tarifaMinima, precoPorKm, velocidadeViagemKmh, velocidadeChegadaKmh, fatorEstrada}
 */

const FIELDS = {
  tarifaMinima: { label: 'Tarifa mínima', min: 0, max: 1000, integer: true },
  precoPorKm: { label: 'Preço por km', min: 0, max: 1000, integer: false },
  velocidadeViagemKmh: { label: 'Velocidade de viagem', min: 5, max: 120, integer: false },
  velocidadeChegadaKmh: { label: 'Velocidade de chegada', min: 5, max: 120, integer: false },
  fatorEstrada: { label: 'Factor de estrada', min: 1, max: 3, integer: false },
} as const;

type Field = keyof typeof FIELDS;

const activeRule = () => prisma.tarifa.findFirst({ where: { ativa: true }, orderBy: { updatedAt: 'desc' } });

export async function GET() {
  try {
    const rule = await activeRule();
    if (!rule) return NextResponse.json({ error: 'Não há tarifa activa' }, { status: 404 });
    return NextResponse.json(rule);
  } catch (error) {
    console.error('Erro ao ler a tarifa:', error);
    return NextResponse.json({ error: 'Erro ao ler a tarifa' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 });

    const data: Partial<Record<Field, number>> = {};
    for (const [key, spec] of Object.entries(FIELDS) as [Field, (typeof FIELDS)[Field]][]) {
      if (body[key] === undefined) continue;
      const value = Number(body[key]);
      if (!Number.isFinite(value) || value < spec.min || value > spec.max || (spec.integer && !Number.isInteger(value))) {
        return NextResponse.json(
          { error: `${spec.label}: indique ${spec.integer ? 'um número inteiro' : 'um número'} entre ${spec.min} e ${spec.max}` },
          { status: 400 }
        );
      }
      data[key] = value;
    }
    if (!Object.keys(data).length) return NextResponse.json({ error: 'Nada para alterar' }, { status: 400 });

    const rule = await activeRule();
    const saved = rule
      ? await prisma.tarifa.update({ where: { id: rule.id }, data })
      : await prisma.tarifa.create({ data: { nome: 'padrao', ativa: true, ...data } });
    return NextResponse.json(saved);
  } catch (error) {
    console.error('Erro ao guardar a tarifa:', error);
    return NextResponse.json({ error: 'Erro ao guardar a tarifa' }, { status: 500 });
  }
}
