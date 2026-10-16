/**
 * How to show "the bus arrives in N minutes". Short waits are shown in minutes; long ones (at
 * night the first bus is at 05:00) as the Maputo clock time, with "amanhã" when it is tomorrow.
 * No server imports: used by pages and by the API.
 */

const TIME_ZONE = 'Africa/Maputo';

function maputoDay(d: Date): string {
  return d.toLocaleDateString('pt-PT', { timeZone: TIME_ZONE });
}

/** "HH:MM" in Maputo. */
export function maputoClock(d: Date): string {
  return d.toLocaleTimeString('pt-PT', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' });
}

export interface EtaText {
  /** Big number or clock time, e.g. "7" or "05:12" */
  value: string;
  /** Word under it, e.g. "minutos" or "amanhã às" */
  unit: string;
  /** One line, e.g. "7 min" or "amanhã às 05:12" */
  text: string;
  /** Long wait: shown as a clock time */
  isClock: boolean;
}

export function formatEta(minutes: number, from: Date = new Date()): EtaText {
  if (minutes < 60) return { value: String(minutes), unit: 'minutos', text: `${minutes} min`, isClock: false };
  const at = new Date(from.getTime() + minutes * 60000);
  const clock = maputoClock(at);
  const tomorrow = maputoDay(at) !== maputoDay(from);
  return {
    value: clock,
    unit: tomorrow ? 'amanhã às' : 'às',
    text: `${tomorrow ? 'amanhã às' : 'às'} ${clock}`,
    isClock: true,
  };
}
