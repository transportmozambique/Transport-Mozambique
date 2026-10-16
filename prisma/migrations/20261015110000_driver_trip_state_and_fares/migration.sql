-- Driver trip state shared by USSD and the driver portal, and one fare rule
-- shared by the web app and USSD. Additive and safe to re-run.

-- AlterTable
ALTER TABLE "Motorista" ADD COLUMN IF NOT EXISTS "emViagem" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Motorista" ADD COLUMN IF NOT EXISTS "viagemIniciadaEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Tarifa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tarifaMinima" INTEGER NOT NULL DEFAULT 10,
    "precoPorKm" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "fatorEstrada" DOUBLE PRECISION NOT NULL DEFAULT 1.3,
    "velocidadeViagemKmh" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "velocidadeChegadaKmh" DOUBLE PRECISION NOT NULL DEFAULT 45,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tarifa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Tarifa_nome_key" ON "Tarifa"("nome");

-- Default fare rule: the values the web app already used
-- (minimum 10 MT, 10 MT/km, bus arrival at 45 km/h, trip at 30 km/h).
INSERT INTO "Tarifa" ("id", "nome", "tarifaMinima", "precoPorKm", "fatorEstrada", "velocidadeViagemKmh", "velocidadeChegadaKmh", "ativa", "updatedAt")
VALUES ('tarifa_padrao', 'padrao', 10, 10, 1.3, 30, 45, true, CURRENT_TIMESTAMP)
ON CONFLICT ("nome") DO NOTHING;
