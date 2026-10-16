// Driver API lives in transport-client (same database as USSD)
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3000";

export interface TripState {
  emViagem: boolean;
  viagemIniciadaEm: string | null;
}
