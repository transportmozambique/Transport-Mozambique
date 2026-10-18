import { prisma } from '@/lib/prisma';
import { getFareRule, orderStopsAlongRoute } from '@/lib/fares';
import { vehicleGeo } from '@/lib/vehiclePosition';

type Driver = {
  id: string;
  nome: string;
  bi: string;
  telefone: string;
  email: string;
  foto: string | null;
  status: string;
  emViagem: boolean;
  viagemIniciadaEm: Date | null;
  categoriaCarta: string;
  experienciaAnos: number;
  transporteId: string | null;
};

export const DRIVER_PROFILE_FIELDS = {
  id: true,
  nome: true,
  bi: true,
  telefone: true,
  email: true,
  foto: true,
  status: true,
  emViagem: true,
  viagemIniciadaEm: true,
  categoriaCarta: true,
  experienciaAnos: true,
  transporteId: true,
} as const;

/**
 * O que o portal do motorista mostra: o motorista, o seu veículo (com a posição actual) e a via
 * do veículo com as paragens pela ordem de viagem. Enviado na entrada (POST /api/driver/login) e
 * de novo por GET /api/driver/me, para que o portal acompanhe uma mudança de veículo ou de via
 * feita no painel de administração sem o motorista ter de sair e entrar.
 */
export async function driverProfile(driver: Driver) {
  const transporte = driver.transporteId
    ? await prisma.transporte.findUnique({
        where: { id: driver.transporteId },
        include: {
          via: {
            include: {
              municipio: { select: { nome: true } },
              paragens: { include: { paragem: true }, orderBy: { id: 'asc' } },
            },
          },
        },
      })
    : null;
  const via = transporte?.via ?? null;

  return {
    id: driver.id,
    nome: driver.nome,
    bi: driver.bi,
    telefone: driver.telefone,
    email: driver.email,
    foto: driver.foto,
    status: driver.status,
    emViagem: driver.emViagem,
    viagemIniciadaEm: driver.viagemIniciadaEm,
    categoriaCarta: driver.categoriaCarta,
    experienciaAnos: driver.experienciaAnos,
    transporte: transporte
      ? {
          id: transporte.id,
          matricula: transporte.matricula,
          marca: transporte.marca,
          modelo: transporte.modelo,
          cor: transporte.cor,
          lotacao: transporte.lotacao,
          // GPS real quando recente, senão a posição pelo horário na via
          currGeoLocation: vehicleGeo(transporte, via?.geoLocationPath, new Date(), await getFareRule()) ?? transporte.currGeoLocation,
        }
      : null,
    via: via
      ? {
          id: via.id,
          nome: via.nome,
          codigo: via.codigo,
          terminalPartida: via.terminalPartida,
          terminalChegada: via.terminalChegada,
          geoLocationPath: via.geoLocationPath,
          municipio: via.municipio?.nome,
          paragens: orderStopsAlongRoute(via.paragens, via.geoLocationPath, (vp) => vp.paragem.geoLocation).map((vp) => ({
            id: vp.paragem.id,
            nome: vp.paragem.nome,
            geoLocation: vp.paragem.geoLocation,
            isTerminal: vp.terminalBoolean,
          })),
        }
      : null,
  };
}
