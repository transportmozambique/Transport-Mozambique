/*
  Warnings:

  - You are about to drop the column `birthDate` on the `Proprietario` table. All the data in the column will be lost.
  - Added the required column `dataInicioOperacoes` to the `Proprietario` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Proprietario" DROP COLUMN "birthDate",
ADD COLUMN     "certificado" TEXT,
ADD COLUMN     "dataInicioOperacoes" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "foto" TEXT,
ADD COLUMN     "tipoProprietario" TEXT NOT NULL DEFAULT 'Empresa';
