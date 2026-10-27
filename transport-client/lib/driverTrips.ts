import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { getFareRule } from './fares';
import { POSITION_FIELDS, hasFreshGps, routeGeometry, vehiclePosition, type Direction } from './vehiclePosition';

/**
 * Identidade do motorista e estado da viagem, partilhados pelo menu USSD do motorista e pelo
 * portal do motorista, para que os dois vejam o mesmo "viagem em curso".
 * O estado da viagem fica em Motorista.emViagem / viagemIniciadaEm / viagemSentido;
 * Motorista.status continua a ser o estado da conta definido pelo administrador (ativo, inativo, suspenso).
 *
 * É também o que põe o autocarro a andar para os passageiros: lib/vehiclePosition.ts só move um
 * autocarro cujo motorista iniciou a viagem, a partir do terminal e da hora de início guardados
 * aqui. Assim o portal, o USSD, a web e o painel dizem todos o mesmo.
 */

export function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, '').replace('+258', '').replace(/^258/, '');
}

/** Encontra o motorista cujo telefone coincide, ignorando espaços e o prefixo +258. */
export async function findDriverByPhone(phone: string) {
  const wanted = normalizePhone(phone);
  if (!wanted) return null;

  // Os telefones estão guardados em formatos diferentes ("+258 84 123 4567"), por isso compara-se depois de normalizar
  const drivers = await prisma.motorista.findMany({ select: { id: true, telefone: true } });
  const match =
    drivers.find((d) => normalizePhone(d.telefone) === wanted) ??
    (wanted.length >= 9 ? drivers.find((d) => normalizePhone(d.telefone).endsWith(wanted)) : undefined);

  return match ? prisma.motorista.findUnique({ where: { id: match.id } }) : null;
}

/**
 * Os motoristas entram (portal e USSD *6) com o PIN que o administrador gerou para eles. Só se
 * guarda o hash bcrypt (um PIN roubado da base de dados não serve); um motorista sem PIN não pode
 * entrar até o administrador criar um.
 */
export async function verifyDriverPin(stored: string | null, input: string): Promise<boolean> {
  if (!stored || !input || !/^\$2[aby]\$/.test(stored)) return false;
  return bcrypt.compare(input, stored);
}

export interface TripState {
  emViagem: boolean;
  viagemIniciadaEm: Date | null;
}

/** Uma viagem que não pode começar; a mensagem é mostrada ao motorista tal como está. */
export class TripError extends Error {}

const tripSelect = { emViagem: true, viagemIniciadaEm: true } as const;

export async function getTripState(motoristaId: string): Promise<TripState | null> {
  return prisma.motorista.findUnique({ where: { id: motoristaId }, select: tripSelect });
}

/** O veículo do motorista com o que é preciso para saber onde está. */
async function driverVehicle(motoristaId: string) {
  const driver = await prisma.motorista.findUnique({
    where: { id: motoristaId },
    select: {
      emViagem: true,
      transporte: { select: { ...POSITION_FIELDS, via: { select: { ativa: true, geoLocationPath: true } } } },
    },
  });
  return driver ? { emViagem: driver.emViagem, vehicle: driver.transporte } : null;
}

/**
 * Inicia uma viagem; se já houver uma em curso, fica como está (mantém a hora de início). A viagem
 * parte do terminal mais perto de onde o autocarro está parado: o do início do percurso da via
 * (sentido 1) ou o do fim (sentido -1).
 */
export async function startTrip(motoristaId: string): Promise<TripState | null> {
  const found = await driverVehicle(motoristaId);
  if (!found) return null;
  if (found.emViagem) return getTripState(motoristaId);
  const vehicle = found.vehicle;
  if (!vehicle) throw new TripError('Não tem veículo atribuído. Peça ao administrador.');
  if (!vehicle.via) throw new TripError('O seu veículo não tem rota. Peça ao administrador.');
  if (!vehicle.via.ativa) throw new TripError('A rota do seu veículo está desactivada. Peça ao administrador.');

  const g = routeGeometry(vehicle.via.geoLocationPath);
  const parked = vehiclePosition(vehicle, g, new Date(), await getFareRule());
  const sentido: Direction = parked?.progress != null && g.length > 0 && parked.progress > g.length / 2 ? -1 : 1;

  await prisma.motorista.updateMany({
    where: { id: motoristaId, emViagem: false },
    data: { emViagem: true, viagemIniciadaEm: new Date(), viagemSentido: sentido },
  });
  return getTripState(motoristaId);
}

/**
 * Termina a viagem. O autocarro fica parado onde está agora (guardado em currGeoLocation), para os
 * passageiros e o painel o verem lá e a viagem seguinte partir do terminal mais perto.
 */
export async function endTrip(motoristaId: string): Promise<TripState | null> {
  const found = await driverVehicle(motoristaId);
  if (!found) return null;
  const vehicle = found.vehicle;
  const now = new Date();
  // Com GPS recente, currGeoLocation já é a posição real
  if (found.emViagem && vehicle?.via && !hasFreshGps(vehicle, now)) {
    const here = vehiclePosition(vehicle, vehicle.via.geoLocationPath, now, await getFareRule());
    if (here) {
      await prisma.transporte.update({
        where: { id: vehicle.id },
        data: { currGeoLocation: `${here.point[0].toFixed(6)},${here.point[1].toFixed(6)}` },
      });
    }
  }
  await prisma.motorista.updateMany({
    where: { id: motoristaId },
    data: { emViagem: false, viagemIniciadaEm: null, viagemSentido: null },
  });
  return getTripState(motoristaId);
}
