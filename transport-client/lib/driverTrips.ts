import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

/**
 * Identidade do motorista e estado da viagem, partilhados pelo menu USSD do motorista e pelo
 * portal do motorista, para que os dois vejam o mesmo "viagem em curso".
 * O estado da viagem fica em Motorista.emViagem / viagemIniciadaEm; Motorista.status continua a
 * ser o estado da conta definido pelo administrador (ativo, inativo, suspenso).
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

const tripSelect = { emViagem: true, viagemIniciadaEm: true } as const;

export async function getTripState(motoristaId: string): Promise<TripState | null> {
  return prisma.motorista.findUnique({ where: { id: motoristaId }, select: tripSelect });
}

/** Inicia uma viagem; se já houver uma em curso, fica como está (mantém a hora de início). */
export async function startTrip(motoristaId: string): Promise<TripState | null> {
  await prisma.motorista.updateMany({
    where: { id: motoristaId, emViagem: false },
    data: { emViagem: true, viagemIniciadaEm: new Date() },
  });
  return getTripState(motoristaId);
}

export async function endTrip(motoristaId: string): Promise<TripState | null> {
  await prisma.motorista.updateMany({
    where: { id: motoristaId },
    data: { emViagem: false, viagemIniciadaEm: null },
  });
  return getTripState(motoristaId);
}
