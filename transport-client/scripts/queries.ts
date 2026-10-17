/**
 * Read-only lists from the database, with Prisma Client.
 *
 *   cd transport-client
 *   npx tsx scripts/queries.ts <list> [argument]
 *
 * Lists: counts · routes [municipality] · stops <route code> · vehicles [route code]
 *        drivers · alerts
 *
 * Uses DATABASE_URL from .env (or the environment). Nothing here writes.
 * Documented in docs/database.md#prisma-client-in-a-script.
 */
import './load-env';
import { prisma } from '../lib/prisma';
import { orderStopsAlongRoute } from '../lib/fares';
import { hasFreshGps } from '../lib/vehiclePosition';

const maputo = (d: Date | null) =>
  d ? d.toLocaleString('pt-PT', { timeZone: 'Africa/Maputo', dateStyle: 'short', timeStyle: 'short' }) : '';

const lists: Record<string, (arg?: string) => Promise<void>> = {
  // Rows per table
  async counts() {
    const [vias, paragens, transportes, motoristas, utentes, alertas] = await Promise.all([
      prisma.via.count(),
      prisma.paragem.count(),
      prisma.transporte.count(),
      prisma.motorista.count(),
      prisma.utente.count(),
      prisma.mISSION.count(),
    ]);
    console.table({ vias, paragens, transportes, motoristas, utentes, alertas });
  },

  // Routes, optionally of one municipality, with their number of stops and vehicles
  async routes(municipio) {
    const vias = await prisma.via.findMany({
      where: municipio ? { municipio: { nome: { contains: municipio, mode: 'insensitive' } } } : {},
      select: {
        codigo: true,
        nome: true,
        municipio: { select: { nome: true } },
        _count: { select: { paragens: true, transportes: true } },
      },
      orderBy: { nome: 'asc' },
    });
    console.table(
      vias.map((v) => ({
        codigo: v.codigo,
        nome: v.nome,
        municipio: v.municipio.nome,
        paragens: v._count.paragens,
        autocarros: v._count.transportes,
      })),
    );
  },

  // The stops of one route, in travel order
  async stops(codigo) {
    if (!codigo) throw new Error('Usage: stops <route code>, e.g. stops VIA-0001');
    const via = await prisma.via.findUnique({
      where: { codigo },
      select: {
        nome: true,
        geoLocationPath: true,
        paragens: { select: { paragem: { select: { codigo: true, nome: true, geoLocation: true } } } },
      },
    });
    if (!via) throw new Error(`No route with code ${codigo}`);
    const ordered = orderStopsAlongRoute(
      via.paragens.map((p) => p.paragem),
      via.geoLocationPath,
      (p) => p.geoLocation,
    );
    console.log(via.nome);
    console.table(ordered.map((p, i) => ({ ordem: i + 1, codigo: p.codigo, nome: p.nome, coordenadas: p.geoLocation })));
  },

  // Vehicles, optionally of one route, with their driver and whether GPS is live
  async vehicles(codigo) {
    const transportes = await prisma.transporte.findMany({
      where: codigo ? { via: { codigo } } : {},
      select: {
        id: true,
        matricula: true,
        marca: true,
        modelo: true,
        lotacao: true,
        currGeoLocation: true,
        gpsAtualizadoEm: true,
        gpsDispositivoHash: true,
        via: { select: { codigo: true, nome: true } },
        motorista: { select: { nome: true, emViagem: true } },
      },
      orderBy: { matricula: 'asc' },
    });
    console.table(
      transportes.map((t) => ({
        matricula: t.matricula,
        veiculo: `${t.marca} ${t.modelo}`,
        lotacao: t.lotacao,
        via: t.via ? `${t.via.codigo} ${t.via.nome}` : '',
        motorista: t.motorista?.nome ?? '',
        emViagem: t.motorista?.emViagem ?? false,
        gps: !t.gpsDispositivoHash ? 'sem dispositivo' : hasFreshGps(t) ? 'ativo' : 'sem sinal',
        ultimaPosicao: maputo(t.gpsAtualizadoEm),
      })),
    );
  },

  // Drivers: PIN set or not, trip state and vehicle
  async drivers() {
    const motoristas = await prisma.motorista.findMany({
      select: {
        nome: true,
        status: true,
        password: true,
        emViagem: true,
        viagemIniciadaEm: true,
        transporte: { select: { matricula: true, via: { select: { codigo: true } } } },
      },
      orderBy: { nome: 'asc' },
    });
    console.table(
      motoristas.map((m) => ({
        nome: m.nome,
        status: m.status,
        temPin: Boolean(m.password),
        emViagem: m.emViagem,
        desde: maputo(m.viagemIniciadaEm),
        transporte: m.transporte?.matricula ?? '',
        via: m.transporte?.via?.codigo ?? '',
      })),
    );
  },

  // Arrival alerts of the last 24 hours (no passenger names or phones)
  async alerts() {
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const missoes = await prisma.mISSION.findMany({
      where: { createdAt: { gte: desde } },
      select: { createdAt: true, paragem: { select: { codigo: true, nome: true } } },
      orderBy: { createdAt: 'desc' },
    });
    console.table(missoes.map((m) => ({ criado: maputo(m.createdAt), paragem: `${m.paragem.codigo} ${m.paragem.nome}` })));
  },
};

async function main() {
  const [name, arg] = process.argv.slice(2);
  const list = name && lists[name];
  if (!list) {
    console.log(`Usage: npx tsx scripts/queries.ts <${Object.keys(lists).join('|')}> [argument]`);
    process.exitCode = 1;
    return;
  }
  await list(arg);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
