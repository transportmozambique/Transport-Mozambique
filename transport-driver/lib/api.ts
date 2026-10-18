// A API do motorista vive no transport-client (a mesma base de dados do USSD), para o portal e o USSD verem o mesmo estado
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3000";

export interface TripState {
  emViagem: boolean;
  viagemIniciadaEm: string | null;
}
