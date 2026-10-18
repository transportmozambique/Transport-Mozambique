/**
 * Como mostrar "o autocarro chega em N minutos". Esperas curtas aparecem em minutos; as longas (à
 * noite o primeiro autocarro é às 05:00) como a hora de Maputo, com "amanhã" quando é no dia
 * seguinte. Sem importações de servidor: usado pelas páginas e pela API.
 */

const TIME_ZONE = 'Africa/Maputo';

function maputoDay(d: Date): string {
  return d.toLocaleDateString('pt-PT', { timeZone: TIME_ZONE });
}

/** "HH:MM" em Maputo. */
export function maputoClock(d: Date): string {
  return d.toLocaleTimeString('pt-PT', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' });
}

export interface EtaText {
  /** Número grande ou hora, ex: "7" ou "05:12" */
  value: string;
  /** Palavra por baixo, ex: "minutos", "hoje" ou "amanhã" */
  unit: string;
  /** Uma linha, ex: "7 min" ou "amanhã às 05:12" */
  text: string;
  /** Espera longa: mostrada como hora */
  isClock: boolean;
}

export function formatEta(minutes: number, from: Date = new Date()): EtaText {
  if (minutes < 60) return { value: String(minutes), unit: 'minutos', text: `${minutes} min`, isClock: false };
  const at = new Date(from.getTime() + minutes * 60000);
  const clock = maputoClock(at);
  const tomorrow = maputoDay(at) !== maputoDay(from);
  return {
    value: clock,
    unit: tomorrow ? 'amanhã' : 'hoje',
    text: `${tomorrow ? 'amanhã às' : 'às'} ${clock}`,
    isClock: true,
  };
}
