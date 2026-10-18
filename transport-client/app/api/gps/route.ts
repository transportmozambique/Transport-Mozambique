import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';

/**
 * Posições GPS reais dos veículos.
 *
 * Cada veículo tem um código de dispositivo, gerado no painel (Transporte → Rastreador GPS); só o
 * seu SHA-256 fica guardado (um código lido da base de dados não serve para enviar posições).
 * Duas formas de enviar uma posição:
 *
 * 1. Protocolo OsmAnd, usado pela aplicação gratuita Traccar Client e pelo reencaminhamento do Traccar:
 *      GET ou POST /api/gps?id=<código>&lat=-25.96&lon=32.58&timestamp=1760000000&speed=10&bearing=90
 *    (velocidade em nós, timestamp em segundos ou milissegundos; os campos também podem vir num formulário)
 *    Porquê este protocolo: qualquer telemóvel Android ou rastreador compatível com Traccar envia-o sem programação.
 *
 * 2. JSON com o código como token "Bearer":
 *      POST /api/gps   Authorization: Bearer <código>
 *      {"latitude": -25.96, "longitude": 32.58, "timestamp": "2026-10-16T10:00:00Z", "speed": 18.5, "heading": 90}
 *    (velocidade em km/h; timestamp opcional, ISO 8601 ou epoch)
 *
 * Responde 200 quando a posição foi guardada (ou era mais antiga do que a última), 400 para
 * coordenadas inválidas, 401 para um código desconhecido.
 */

// O portal do motorista (outro domínio) envia posições a partir do navegador
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const MAX_ACCURACY_M = 200; // posições menos precisas do que isto são ignoradas
const MAX_FUTURE_MS = 2 * 60 * 1000;

type Fields = Record<string, string | number | null | undefined>;

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseTimestamp(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (Number.isFinite(n)) return new Date(n < 1e12 ? n * 1000 : n); // segundos ou milissegundos
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

async function readFields(request: NextRequest): Promise<{ fields: Fields; json: boolean }> {
  const fields: Fields = Object.fromEntries(request.nextUrl.searchParams.entries());
  if (request.method !== 'POST') return { fields, json: false };
  const type = request.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const body = await request.json().catch(() => null);
    if (body && typeof body === 'object') Object.assign(fields, body);
    return { fields, json: true };
  }
  if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
    const form = await request.formData().catch(() => null);
    form?.forEach((value, key) => {
      if (typeof value === 'string') fields[key] = value;
    });
  }
  return { fields, json: false };
}

async function handle(request: NextRequest) {
  const { fields, json } = await readFields(request);

  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  const code = (bearer || String(fields.id ?? fields.deviceid ?? '')).trim();
  if (!code) return NextResponse.json({ error: 'Código do dispositivo em falta' }, { status: 401 });

  const lat = num(fields.lat ?? fields.latitude);
  const lng = num(fields.lon ?? fields.lng ?? fields.longitude);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) {
    return NextResponse.json({ error: 'Coordenadas inválidas' }, { status: 400 });
  }

  const vehicle = await prisma.transporte.findUnique({
    where: { gpsDispositivoHash: createHash('sha256').update(code).digest('hex') },
    select: { id: true, gpsAtualizadoEm: true },
  });
  if (!vehicle) return NextResponse.json({ error: 'Dispositivo desconhecido' }, { status: 401 });

  const accuracy = num(fields.accuracy);
  if (accuracy !== null && accuracy > MAX_ACCURACY_M) {
    return NextResponse.json({ ok: true, ignored: 'precisão insuficiente' });
  }

  const now = Date.now();
  let at = parseTimestamp(fields.timestamp ?? fields.time) ?? new Date(now);
  if (at.getTime() > now + MAX_FUTURE_MS) at = new Date(now);
  // Os telemóveis reenviam as posições em fila depois de perder o sinal: fica só a mais recente
  if (vehicle.gpsAtualizadoEm && at <= vehicle.gpsAtualizadoEm) {
    return NextResponse.json({ ok: true, ignored: 'posição mais antiga do que a última' });
  }

  const speed = num(fields.speed);
  const heading = num(fields.bearing ?? fields.heading ?? fields.course);
  await prisma.transporte.update({
    where: { id: vehicle.id },
    data: {
      currGeoLocation: `${lat.toFixed(6)},${lng.toFixed(6)}`,
      gpsAtualizadoEm: at,
      // O OsmAnd envia nós, o formato JSON km/h
      gpsVelocidade: speed === null ? null : Math.round((json ? speed : speed * 1.852) * 10) / 10,
      gpsDirecao: heading === null ? null : ((heading % 360) + 360) % 360,
    },
  });
  return NextResponse.json({ ok: true });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest) {
  let response: NextResponse;
  try {
    response = await handle(request);
  } catch (error) {
    console.error('Erro ao receber posição GPS:', error);
    response = NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
  for (const [k, v] of Object.entries(CORS)) response.headers.set(k, v);
  return response;
}

export const GET = POST;
