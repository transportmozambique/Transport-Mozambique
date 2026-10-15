/*
  Warnings:

  - Added the required column `contatoEmergencia` to the `Motorista` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dataEmissaoBI` to the `Motorista` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dataEmissaoCarta` to the `Motorista` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dataValidadeBI` to the `Motorista` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dataValidadeCarta` to the `Motorista` table without a default value. This is not possible if the table is not empty.
  - Added the required column `numeroEmergencia` to the `Motorista` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Motorista" ADD COLUMN     "categoriaCarta" TEXT NOT NULL DEFAULT 'B',
ADD COLUMN     "contatoEmergencia" TEXT NOT NULL,
ADD COLUMN     "dataEmissaoBI" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "dataEmissaoCarta" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "dataValidadeBI" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "dataValidadeCarta" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "deficiencia" TEXT,
ADD COLUMN     "estadoCivil" TEXT NOT NULL DEFAULT 'Solteiro',
ADD COLUMN     "experienciaAnos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "foto" TEXT,
ADD COLUMN     "genero" TEXT NOT NULL DEFAULT 'Masculino',
ADD COLUMN     "nacionalidade" TEXT NOT NULL DEFAULT 'Moçambicana',
ADD COLUMN     "numeroEmergencia" TEXT NOT NULL,
ADD COLUMN     "observacoes" TEXT;
