-- Fixes found in the October 2026 assessment. Additive and safe to re-run.

-- Municipality centre (lat,lng) used by the admin dashboard maps. The admin
-- schema already had this field but no migration created it, so reading or
-- saving a municipality failed.
ALTER TABLE "Municipio" ADD COLUMN IF NOT EXISTS "geoLocation" TEXT;

-- When the last bus-arrival SMS was sent for a mission, so the simulator stops
-- re-sending it every cycle while the bus is near the stop.
ALTER TABLE "MISSION" ADD COLUMN IF NOT EXISTS "notificadoEm" TIMESTAMP(3);

-- Columns the apps already use that no earlier migration created (the
-- production database got them outside migrations, so these are no-ops there
-- and only matter for a database built from migrations).
ALTER TABLE "Motorista" ADD COLUMN IF NOT EXISTS "password" TEXT;
ALTER TABLE "Proprietario" ADD COLUMN IF NOT EXISTS "tipoProprietario" TEXT NOT NULL DEFAULT 'Indivíduo';

-- A bus can exist without a route, and deleting a route keeps its buses
ALTER TABLE "Transporte" ALTER COLUMN "viaId" DROP NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Transporte_viaId_fkey' AND confdeltype = 'n') THEN
    ALTER TABLE "Transporte" DROP CONSTRAINT IF EXISTS "Transporte_viaId_fkey";
    ALTER TABLE "Transporte" ADD CONSTRAINT "Transporte_viaId_fkey" FOREIGN KEY ("viaId") REFERENCES "Via"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
