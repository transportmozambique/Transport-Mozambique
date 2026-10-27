// A API do motorista vive no transport-client (a mesma base de dados do USSD), para o portal e o USSD verem o mesmo estado
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3000";

/** O autocarro do motorista como os passageiros o vêem agora (GET /api/driver/trip) */
export interface BusNow {
  lat: number;
  lng: number;
  direcao: number | null;
  fonte: "gps" | "horario";
  /** "Em circulação", "No terminal", ou "Fora de serviço" antes de iniciar a viagem */
  estado: string;
  velocidade: number;
  sentido: string;
  proximas: { nome: string; minutos: number }[];
}

export interface TripState {
  emViagem: boolean;
  viagemIniciadaEm: string | null;
  /** null quando o motorista não tem veículo, ou a rota está desactivada */
  autocarro?: BusNow | null;
}
