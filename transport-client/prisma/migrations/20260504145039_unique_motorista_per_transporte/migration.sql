/*
  Warnings:

  - A unique constraint covering the columns `[transporteId]` on the table `Motorista` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Motorista_transporteId_key" ON "Motorista"("transporteId");
