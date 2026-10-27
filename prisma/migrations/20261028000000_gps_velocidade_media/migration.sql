-- A velocidade média recente das posições GPS de um veículo, em km/h, com as paragens e o trânsito:
-- as horas de chegada e os avisos por SMS usam-na em vez da velocidade fixa da tarifa
-- (transport-client/lib/vehiclePosition.ts). Pode correr-se mais de uma vez (IF NOT EXISTS): a
-- produção não tem histórico do prisma migrate (docs/base-de-dados.md).
ALTER TABLE "Transporte" ADD COLUMN IF NOT EXISTS "gpsVelocidadeMedia" DOUBLE PRECISION;
