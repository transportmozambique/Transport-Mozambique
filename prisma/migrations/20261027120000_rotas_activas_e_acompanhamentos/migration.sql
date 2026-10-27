-- Rotas activas, sentido da viagem do motorista, e os acompanhamentos por SMS. Pode correr-se mais
-- de uma vez (IF NOT EXISTS): a produção não tem histórico do prisma migrate (docs/base-de-dados.md).

-- Só as rotas activas aparecem na web, no USSD e nos SMS; as outras ficam guardadas para o painel
ALTER TABLE "Via" ADD COLUMN IF NOT EXISTS "ativa" BOOLEAN NOT NULL DEFAULT true;

-- De que terminal partiu a viagem em curso: 1 do início do percurso da via, -1 do fim
ALTER TABLE "Motorista" ADD COLUMN IF NOT EXISTS "viagemSentido" INTEGER;

-- Uma viagem que o passageiro pediu para acompanhar por SMS (lib/journeyAlerts.ts)
CREATE TABLE IF NOT EXISTS "Acompanhamento" (
    "id" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "utenteId" TEXT,
    "etapas" JSONB NOT NULL,
    "destinoId" TEXT,
    "destinoNome" TEXT NOT NULL,
    "etapa" INTEGER NOT NULL DEFAULT 0,
    "aviso" INTEGER NOT NULL DEFAULT 0,
    "transporteId" TEXT,
    "terminadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Acompanhamento_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Acompanhamento_terminadoEm_idx" ON "Acompanhamento"("terminadoEm");
CREATE INDEX IF NOT EXISTS "Acompanhamento_telefone_idx" ON "Acompanhamento"("telefone");
