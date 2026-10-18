/**
 * Listas só de leitura da base de dados, com o Prisma Client.
 *
 *   cd transport-client
 *   npx tsx scripts/queries.ts <lista> [argumento]
 *
 * Listas: counts · routes [município] · stops <código da rota> · vehicles [código da rota]
 *         drivers · alerts
 *
 * Usa DATABASE_URL do .env (ou do ambiente). Nada aqui escreve, por isso pode correr contra a
 * produção sem risco. Explicado em docs/base-de-dados.md#prisma-client-num-script.
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

  // Rotas, opcionalmente de um município, com o número de paragens e de veículos
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

  // As paragens de uma rota, pela ordem de viagem
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

  // Veículos, opcionalmente de uma rota, com o motorista e se o GPS está ao vivo
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

  // Motoristas: com PIN ou não, estado da viagem e veículo
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

  // Alertas de chegada das últimas 24 horas (sem nomes nem telefones de passageiros)
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
