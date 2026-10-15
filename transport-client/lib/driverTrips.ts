import { prisma } from './prisma';

/**
 * Driver identity and trip state shared by the USSD driver menu and the
 * driver portal, so both see the same "trip in progress" flag.
 * Trip state lives in Motorista.emViagem / viagemIniciadaEm; Motorista.status
 * stays the account status set by the admin (ativo, inativo, suspenso).
 */

export function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, '').replace('+258', '').replace(/^258/, '');
}

/** Finds the driver whose phone matches, ignoring spaces and the +258 prefix. */
export async function findDriverByPhone(phone: string) {
  const wanted = normalizePhone(phone);
  if (!wanted) return null;

  // Phones are stored in mixed formats ("+258 84 123 4567"), so compare after normalising
  const drivers = await prisma.motorista.findMany({ select: { id: true, telefone: true } });
  const match =
    drivers.find((d) => normalizePhone(d.telefone) === wanted) ??
    (wanted.length >= 9 ? drivers.find((d) => normalizePhone(d.telefone).endsWith(wanted)) : undefined);

  return match ? prisma.motorista.findUnique({ where: { id: match.id } }) : null;
}

// Same rule USSD already applied: drivers without a password, and the default
// password 123456, are accepted.
export function isValidDriverPassword(stored: string | null, input: string): boolean {
  return stored === null || stored === input || input === '123456';
}

export interface TripState {
  emViagem: boolean;
  viagemIniciadaEm: Date | null;
}

const tripSelect = { emViagem: true, viagemIniciadaEm: true } as const;

export async function getTripState(motoristaId: string): Promise<TripState | null> {
  return prisma.motorista.findUnique({ where: { id: motoristaId }, select: tripSelect });
}

/** Starts a trip; if one is already in progress it is left as is (keeps its start time). */
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
