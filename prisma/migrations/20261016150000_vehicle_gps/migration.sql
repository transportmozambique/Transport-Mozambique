-- Real GPS positions from vehicles (POST /api/gps). Safe to re-run.
ALTER TABLE "Transporte" ADD COLUMN IF NOT EXISTS "gpsDispositivoHash" TEXT;
ALTER TABLE "Transporte" ADD COLUMN IF NOT EXISTS "gpsAtualizadoEm" TIMESTAMP(3);
ALTER TABLE "Transporte" ADD COLUMN IF NOT EXISTS "gpsVelocidade" DOUBLE PRECISION;
ALTER TABLE "Transporte" ADD COLUMN IF NOT EXISTS "gpsDirecao" DOUBLE PRECISION;
CREATE UNIQUE INDEX IF NOT EXISTS "Transporte_gpsDispositivoHash_key" ON "Transporte"("gpsDispositivoHash");
