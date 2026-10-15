export interface Transport {
  id: string;
  matricula: string;
  via: string;
  direcao: string;
  distancia: number; // distância da viagem (origem → destino) em metros
  tempoEstimado: number; // minutos até o autocarro chegar à origem
  tempoViagem?: number; // minutos a bordo (origem → destino)
  jaPassou?: boolean; // o autocarro já passou a origem e volta na próxima volta
  velocidade: number;
  latitude: number;
  longitude: number;
  status: "Em Circulação" | "Parado";
  
  // New fields for complete journey information
  journeyTime?: number; // Tempo da viagem (pickup → destination) em minutos
  journeyDistance?: number; // Distância da viagem (pickup → destination) em metros
  totalTime?: number; // Tempo total (autocarro + viagem) em minutos
  fare?: number; // Preço da viagem em MT
  fullRoute?: string; // Rota completa do autocarro
  userJourney?: {
    from: string;
    to: string;
    fromId: string;
    toId: string;
  };
}

export interface Via {
  id: string;
  nome: string;
  municipio: string;
  preco: number;
}

export interface Paragem {
  id: string;
  nome: string;
  via: string;
  latitude: number;
  longitude: number;
}
